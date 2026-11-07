#!/usr/bin/env node
// 画廊上传脚本：预览版压缩 + 全图版按需处理 → 上传 R2
//
// 用法：
//   pnpm gallery:upload                 ← 使用默认收件箱（文章仓库旁 .gallery-inbox/，不存在则自动创建）
//   node scripts/gallery-upload.mjs <图片文件或目录...> [--dry-run]
//   pnpm gallery:upload ./我的画 --dry-run
//
// 产物：
//   gallery/<名称>.<png|jpg>        预览版：宽 1200px，网格加载用（质量阶梯 + 5MB 保险丝）
//   gallery-full/<名称>.<原扩展名>  全图版：≤10MB 原样直传（零损失）；
//                                   >10MB 才最小损失压缩到 10MB 内
//                                   （保持原始尺寸，先降质量，宽高缩放做最后手段）
//
// 上传成功的原图自动移入 uploaded/ 子文件夹。
// 上传需要 R2 Token 具有 Object Read & Write 权限（.env 里的
// R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY），403 时会给出提示。

import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AwsClient } from 'aws4fetch'
import sharp from 'sharp'

const PREVIEW_WIDTH = 1200
const PREVIEW_HEIGHT = 1800
const PREVIEW_BUDGET = 5 * 1024 * 1024 // 预览版保险丝（正常远达不到）
const FULL_BUDGET = 10 * 1024 * 1024 // 全图版：≤10MB 原样直传，超过才压缩
const KB = 1024

const dryRun = process.argv.includes('--dry-run')
const args = process.argv.slice(2).filter((a) => a !== '--dry-run')

/** 默认收件箱：文章仓库旁的 .gallery-inbox（点前缀，Obsidian 里不显示） */
const DEFAULT_INBOX = resolve(
    fileURLToPath(new URL('..', import.meta.url)), // 网站仓库根
    '..',
    '..',
    '-Summer-Annual-Blog-Article',
    '.gallery-inbox'
)

let inputs = args
let usingDefaultInbox = false
if (inputs.length === 0) {
    mkdirSync(DEFAULT_INBOX, { recursive: true })
    inputs = [DEFAULT_INBOX]
    usingDefaultInbox = true
    console.log(`未指定输入，使用默认收件箱: ${DEFAULT_INBOX}`)
}

// ---- .env（与 utils/gallery.ts 同一套变量）----

import { readFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
function env(key) {
    const text = readFileSync(
        resolve(fileURLToPath(new URL('..', import.meta.url)), '.env'),
        'utf8'
    )
    const line = text.split(/\r?\n/).find((l) => l.startsWith(key + '='))
    return line
        ?.slice(key.length + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
}

const accessKeyId = env('R2_ACCESS_KEY_ID')
const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
const accountId = env('CLOUDFLARE_ACCOUNT_ID')
const bucket = env('R2_BUCKET')

if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    console.error(
        '缺少 R2 环境变量（.env: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / CLOUDFLARE_ACCOUNT_ID / R2_BUCKET）'
    )
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
        // 显式按文件名排序：批内处理顺序 = 上传时间顺序（画廊排序的平局裁决依据）
        for (const f of dir.sort())
            if (IMAGE_EXT.test(f)) files.push(join(p, f))
    } else {
        files.push(p)
    }
}
if (files.length === 0) {
    if (usingDefaultInbox) {
        console.log('收件箱里没有图片，无需上传')
        process.exit(0)
    }
    console.error('输入里没有找到图片文件')
    process.exit(1)
}

// ---- 压缩 ----

/** JPG 编码：flatten 落底色（源图可能带"空的" alpha 通道） */
async function encodeJpg(input, width, height, quality) {
    return sharp(input)
        .rotate() // 按 EXIF 摆正
        .flatten({ background: '#ffffff' })
        .resize({ width, height, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })
}

/** 迭代输出直到 ≤ 预算：先降质量，宽高缩放做最后手段 */
async function encodeWithBudget(input, width, height, format, budget) {
    let q = 95
    let w = width
    for (;;) {
        const buf =
            format === 'png'
                ? await sharp(input)
                      .rotate()
                      .resize({
                          width: w,
                          height,
                          fit: 'inside',
                          withoutEnlargement: true,
                      })
                      // 调色板量化：透明插画 PNG 的体积主力，视觉损失难以察觉
                      .png({
                          compressionLevel: 9,
                          palette: true,
                          quality: q,
                          dither: 1,
                      })
                      .toBuffer()
                : (await encodeJpg(input, w, height, q)).data
        if (buf.length <= budget || q <= 70) {
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
    const { hasAlpha, meta } = await detectRealAlpha(file)
    const srcExt = extname(file).toLowerCase()
    const name = basename(file, extname(file))
    const srcSize = (await stat(file)).size

    // 预览版：宽 1200（网格加载用），质量阶梯 + 5MB 保险丝维持现状
    const previewFormat = hasAlpha || srcExt === '.png' ? 'png' : 'jpg'
    const preview = await encodeWithBudget(
        file,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
        previewFormat,
        PREVIEW_BUDGET
    )

    // 全图版：≤10MB 原样直传（零损失，不缩放不转格式不重编码）；
    // >10MB 才最小损失压缩到 10MB 内（保持原始尺寸，先降质量，
    // 宽高缩放做最后手段）。直传仅限 png/jpg——其他格式的预览版
    // 扩展名与之不同，直传会导致站点的全图 URL 404
    const passthrough =
        srcSize <= FULL_BUDGET &&
        (srcExt === '.png' || srcExt === '.jpg' || srcExt === '.jpeg')
    let fullBuf
    let fullExt
    if (passthrough) {
        fullBuf = readFileSync(file)
        fullExt = srcExt === '.jpeg' ? 'jpg' : srcExt.slice(1)
    } else {
        const fullFormat = srcExt === '.png' ? 'png' : 'jpg'
        const encoded = await encodeWithBudget(
            file,
            meta.width,
            meta.height,
            fullFormat,
            FULL_BUDGET
        )
        fullBuf = encoded.buf
        fullExt = fullFormat
    }

    return {
        name,
        ext: previewFormat,
        fullExt,
        passthrough,
        preview: preview.buf,
        full: fullBuf,
        previewKB: Math.round(preview.buf.length / KB),
        fullKB: Math.round(fullBuf.length / KB),
    }
}

// ---- 上传 ----

const CONTENT_TYPES = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
}

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
let failed = 0

for (const file of files) {
    try {
        const out = await processOne(file)
        const base = out.name
        console.log(
            `${base}: 预览 ${out.previewKB}KB / 全图 ${out.fullKB}KB` +
                (out.passthrough ? '（原样直传）' : '（已压缩至 10MB 内）')
        )
        if (dryRun) continue

        let ok = true
        for (const [key, body, ext] of [
            [`gallery/${base}.${out.ext}`, out.preview, out.ext],
            [`gallery-full/${base}.${out.fullExt}`, out.full, out.fullExt],
        ]) {
            const res = await upload(
                r2,
                body,
                key,
                CONTENT_TYPES[ext] ?? 'application/octet-stream'
            )
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
                    console.error(
                        `  ✗ 上传 ${key} 失败: ${res.status} ${text.slice(0, 200)}`
                    )
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
