#!/usr/bin/env node
// 画廊上传脚本：压缩（双尺寸）→ 上传 R2
//
// 用法：
//   node scripts/gallery-upload.mjs <图片文件或目录...> [--dry-run]
//   pnpm gallery:upload ./我的画
//
// 产物（均为 jpg；源图带透明通道时保留 png）：
//   gallery/<名称>.jpg      预览版：宽 1200px，网格用
//   gallery-full/<名称>.jpg 全图版：宽 2560px，灯箱放大用
//
// 约束：单张 100KB–5MB（用户约定）。超限时自动降质量/降宽度，
// 降到下限仍超标则原样上传并给出警告。
// 上传需要 R2 Token 具有 Object Read & Write 权限（.env 里的
// R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY），403 时会给出提示。

import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AwsClient } from 'aws4fetch'
import sharp from 'sharp'

const PREVIEW_WIDTH = 1200
const FULL_WIDTH = 2560
const MAX_BYTES = 5 * 1024 * 1024
const MB = 1024 * 1024
const KB = 1024

const dryRun = process.argv.includes('--dry-run')
const inputs = process.argv.slice(2).filter((a) => a !== '--dry-run')

if (inputs.length === 0) {
    console.error('用法: node scripts/gallery-upload.mjs <图片文件或目录...> [--dry-run]')
    process.exit(1)
}

// ---- .env（与 utils/gallery.ts 同一套变量）----

import { readFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
function env(key) {
    const text = readFileSync(
        resolve(fileURLToPath(new URL('..', import.meta.url)), '.env'),
        'utf8'
    )
    const line = text
        .split(/\r?\n/)
        .find((l) => l.startsWith(key + '='))
    return line?.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
}

const accessKeyId = env('R2_ACCESS_KEY_ID')
const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
const accountId = env('CLOUDFLARE_ACCOUNT_ID')
const bucket = env('R2_BUCKET')

if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    console.error('缺少 R2 环境变量（.env: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / CLOUDFLARE_ACCOUNT_ID / R2_BUCKET）')
    process.exit(1)
}

// ---- 收集输入文件 ----

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i
const files = []
for (const input of inputs) {
    const p = resolve(input)
    const s = await stat(p)
    if (s.isDirectory()) {
        const dir = await readdir(p)
        for (const f of dir) if (IMAGE_EXT.test(f)) files.push(join(p, f))
    } else {
        files.push(p)
    }
}
if (files.length === 0) {
    console.error('输入里没有找到图片文件')
    process.exit(1)
}

// ---- 压缩 ----

/** 迭代输出直到 ≤ 上限：先降质量，再降宽度 */
async function encodeJpg(input, width, height, quality) {
    // flatten：源图可能带着"空的" alpha 通道，JPG 需要先落到实底色
    return sharp(input)
        .rotate() // 按 EXIF 摆正
        .flatten({ background: '#ffffff' })
        .resize({ width, height, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })
}

/** 迭代输出直到 ≤ 上限：先降质量，再降宽度 */
async function encodeWithBudget(input, width, height, format) {
    let q = 95
    let w = width
    for (;;) {
        const buf =
            format === 'png'
                ? await sharp(input)
                      .rotate()
                      .resize({ width: w, height, fit: 'inside', withoutEnlargement: true })
                      // 调色板量化：透明插画 PNG 的体积主力，视觉损失难以察觉
                      .png({ compressionLevel: 9, palette: true, quality: q, dither: 1 })
                      .toBuffer()
                : (await encodeJpg(input, w, height, q)).data
        if (buf.length <= MAX_BYTES || q <= 70) {
            return { buf, width: w, quality: q }
        }
        if (q > 78) {
            q -= 6
        } else {
            w = Math.round(w * 0.85)
        }
    }
}

/** hasAlpha 只表示"存在 alpha 通道"，导出工具经常带一个全不透明的空通道。
    只有真的存在透明像素（alpha 最小值 < 255）才值得用 PNG */
async function detectRealAlpha(file) {
    const meta = await sharp(file).metadata()
    if (!meta.hasAlpha) return { hasAlpha: false, meta }
    const stats = await sharp(file).stats()
    const alphaMin = stats.channels[3]?.min ?? 255
    return { hasAlpha: alphaMin < 255, meta }
}

async function processOne(file) {
    const { hasAlpha } = await detectRealAlpha(file)
    const srcExt = extname(file).toLowerCase()
    // 输出优先 PNG（透明保留 + 调色板量化）；源图本身是 JPG 时沿用 JPG
    let format = hasAlpha || srcExt === '.png' ? 'png' : 'jpg'
    const name = basename(file, extname(file))

    // 同时约束宽和高，竖版画不再被单边限制放大像素量
    let preview = await encodeWithBudget(file, PREVIEW_WIDTH, 1800, format)
    let full = await encodeWithBudget(file, FULL_WIDTH, 3840, format)

    // PNG 用尽质量/宽度阶梯仍压不进 5MB（细节极多的位图）才退回 JPG
    if (format === 'png' && full.buf.length > MAX_BYTES) {
        console.log(`  ${name}: PNG 超出 5MB 上限，退回 JPG`)
        format = 'jpg'
        preview = await encodeWithBudget(file, PREVIEW_WIDTH, 1800, 'jpg')
        full = await encodeWithBudget(file, FULL_WIDTH, 3840, 'jpg')
    }

    return {
        name,
        ext: format,
        preview: preview.buf,
        full: full.buf,
        previewKB: Math.round(preview.buf.length / KB),
        fullKB: Math.round(full.buf.length / KB),
        fullOverBudget: full.buf.length > MAX_BYTES,
    }
}

// ---- 上传 ----

async function upload(r2, body, key, contentType) {
    const url = new URL(
        `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`
    )
    const res = await r2.fetch(url.toString(), {
        method: 'PUT',
        body,
        headers: { 'Content-Type': contentType },
    })
    return res
}

// ---- 主流程 ----

const r2 = new AwsClient({ accessKeyId, secretAccessKey })
const contentTypeFor = (ext) => (ext === 'png' ? 'image/png' : 'image/jpeg')
let failed = 0

for (const file of files) {
    try {
        const out = await processOne(file)
        const base = out.name
        console.log(
            `${base}: 预览 ${out.previewKB}KB / 全图 ${out.fullKB}KB` +
                (out.fullOverBudget ? '  ⚠️ 全图超过 5MB，已尽力压缩' : '')
        )
        if (dryRun) continue

        let ok = true
        for (const [key, body, ext] of [
            [`gallery/${base}.${out.ext}`, out.preview, out.ext],
            [`gallery-full/${base}.${out.ext}`, out.full, out.ext],
        ]) {
            const res = await upload(r2, body, key, contentTypeFor(ext))
            if (!res.ok) {
                ok = false
                failed++
                const text = await res.text().catch(() => '')
                if (res.status === 403) {
                    console.error(
                        `  ✗ 上传 ${key} 被拒绝(403)：当前 R2 Token 是只读的。\n` +
                            '    请到 Cloudflare → R2 → Manage R2 API Tokens 创建一个\n' +
                            '    Object Read & Write 权限的 Token，更新 .env 后重跑。'
                    )
                } else {
                    console.error(`  ✗ 上传 ${key} 失败: ${res.status} ${text.slice(0, 200)}`)
                }
            }
        }

        // 上传成功的原图移入 uploaded/ 子文件夹，inbox 里只剩没传过的
        if (ok) {
            const uploadedDir = join(dirname(file), 'uploaded')
            mkdirSync(uploadedDir, { recursive: true })
            renameSync(file, join(uploadedDir, basename(file)))
        }
    } catch (err) {
        failed++
        console.error(`${file}: 处理失败`, err)
    }
}

console.log(
    dryRun
        ? `\n(dry-run 完成，未上传。去掉 --dry-run 执行真实上传)`
        : failed === 0
          ? `\n全部完成 ✓`
          : `\n完成，但有 ${failed} 个失败项`
)
process.exit(failed === 0 ? 0 : 1)
