#!/usr/bin/env node
// 画廊上传脚本：单次或监视模式 → 上传 R2
//
// 用法：
//   pnpm gallery:upload                       单次：处理收件箱现有图片后退出
//   pnpm gallery:upload --watch               监视模式：持续监视收件箱，
//                                             图片就绪即自动上传，按任意键退出
//   pnpm gallery:upload <图片文件或目录...>    处理指定文件/目录后退出
//   以上均可加 --dry-run（只报告体积，不上传不改清单；与 --watch 互斥）
//
// 产物：
//   gallery/<名称>.<原扩展名>  完整图片：网格与灯箱共用同一份。
//   ≤10MB 原样直传（零损失，不缩放不转格式不重编码）；
//   >10MB 才最小损失压缩到 10MB 内（保持原始尺寸，先降质量，
//   宽高缩放做最后手段）。
//
// 上传成功的原图自动移入 uploaded/ 子文件夹。
// 监视模式需要交互终端（按任意键退出）。
// 上传需要 R2 Token 具有 Object Read & Write 权限（.env 里的
// R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY），403 时会给出提示。

import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import { AwsClient } from 'aws4fetch'
import sharp from 'sharp'

const PREVIEW_WIDTH = 1200
const PREVIEW_HEIGHT = 1800
const PREVIEW_BUDGET = 5 * 1024 * 1024 // 预览版保险丝（正常远达不到）
const FULL_BUDGET = 10 * 1024 * 1024 // 全图版：≤10MB 原样直传，超过才压缩
const KB = 1024
const SCAN_INTERVAL_MS = 2000

const dryRun = process.argv.includes('--dry-run')
const watchMode = process.argv.includes('--watch')
const args = process.argv.slice(2).filter(
    (a) => a !== '--dry-run' && a !== '--watch'
)

if (dryRun && watchMode) {
    console.error('--dry-run 与 --watch 不能同时使用')
    process.exit(1)
}

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

/** 单次模式：列出输入里的全部图片（无稳定检测——文件在跑脚本前就已就位） */
function collectAllFiles() {
    const files = []
    for (const input of inputs) {
        const p = resolve(input)
        const s = statSync(p)
        if (s.isDirectory()) {
            const dir = readdirSync(p)
            // 显式按文件名排序：批内处理顺序 = 上传时间顺序（画廊排序的平局裁决依据）
            for (const f of dir.sort())
                if (IMAGE_EXT.test(f)) files.push(join(p, f))
        } else {
            files.push(p)
        }
    }
    return files
}

const lastScan = new Map() // 路径 → { size, mtimeMs }（上一次扫描，用于判断"复制完成"）

/** 监视模式：只返回大小与修改时间都已稳定的文件——
    防止把还在往收件箱拷贝途中的半截文件传上去 */
function collectReadyFiles() {
    const ready = []
    for (const input of inputs) {
        const p = resolve(input)
        let entries
        try {
            entries = readdirSync(p)
        } catch {
            continue // 目录暂时读不到，下轮再试
        }
        for (const f of entries.sort()) {
            if (!IMAGE_EXT.test(f)) continue
            const full = join(p, f)
            let st
            try {
                st = statSync(full)
            } catch {
                continue // 文件刚被移走
            }
            if (!st.isFile()) continue
            const prev = lastScan.get(full)
            lastScan.set(full, { size: st.size, mtimeMs: st.mtimeMs })
            if (
                prev &&
                prev.size === st.size &&
                prev.mtimeMs === st.mtimeMs
            ) {
                ready.push(full)
            }
        }
    }
    // 从收件箱消失的文件：清掉跟踪状态
    for (const key of [...lastScan.keys()]) {
        if (!existsSync(key)) lastScan.delete(key)
    }
    return ready
}

// ---- 压缩 ----

/** JPG 编码：flatten 落底色（源图可能带着"空的" alpha 通道） */
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

async function processOne(file) {
    const srcExt = extname(file).toLowerCase()
    const name = basename(file, extname(file))
    const srcSize = statSync(file).size

    // ≤10MB：原样直传（原始字节，零损失——不缩放、不转格式、不重编码）；
    // >10MB：最小损失压缩到 10MB 内（保持原始尺寸，先降质量，
    // 宽高缩放做最后手段）。仅 png/jpg 源走压缩路径——其他格式的
    // 完整图扩展名会与预览版不一致，导致站点的图片 URL 404
    let buf
    let ext
    if (srcSize <= FULL_BUDGET) {
        buf = readFileSync(file)
        ext = srcExt === '.jpeg' ? 'jpg' : srcExt.slice(1)
    } else if (srcExt === '.png' || srcExt === '.jpg' || srcExt === '.jpeg') {
        const meta = await sharp(file).metadata()
        ext = srcExt === '.png' ? 'png' : 'jpg'
        const encoded = await encodeWithBudget(
            file,
            meta.width,
            meta.height,
            ext,
            FULL_BUDGET
        )
        buf = encoded.buf
    } else {
        console.error(
            `  ✗ ${name}${srcExt} 超过 10MB 且不是 png/jpg，无法自动压缩，跳过`
        )
        return null
    }

    return {
        name,
        ext,
        buf,
        kb: Math.round(buf.length / KB),
        passthrough: srcSize <= FULL_BUDGET,
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

/** 处理并上传一张图，成功后归档原图并更新顺序清单 */
async function uploadOne(file) {
    const out = await processOne(file)
    if (!out) return true // 跳过的不算失败
    const base = out.name
    console.log(
        `${base}.${out.ext}: ${out.kb}KB` +
            (out.passthrough ? '（原样直传）' : '（已压缩）')
    )
    if (dryRun) return true

    let ok = true
    const key = `gallery/${base}.${out.ext}`
    const res = await upload(
        r2,
        out.buf,
        key,
        CONTENT_TYPES[out.ext] ?? 'application/octet-stream'
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

    // 上传成功的原图移入 uploaded/ 子文件夹，inbox 里只剩没传过的
    if (ok) {
        const uploadedDir = join(dirname(file), 'uploaded')
        mkdirSync(uploadedDir, { recursive: true })
        renameSync(file, join(uploadedDir, basename(file)))
        // 顺序清单：新图自动置顶（与画廊“新的在前”一致）
        updateOrderList([`${base}.${out.ext}`])
    }
    return ok
}

// ---- 顺序清单（src/config/gallery-order.txt）----
// 每行一个文件名，从上到下 = 画廊展示顺序。上传脚本自动把新图置顶；
// 手动调整顺序 = 直接编辑这个文件挪行，随下一次 push 生效

function updateOrderList(names) {
    const listPath = resolve(
        fileURLToPath(new URL('..', import.meta.url)),
        'src/config/gallery-order.txt'
    )
    let lines = []
    try {
        lines = readFileSync(listPath, 'utf8')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
    } catch {
        // 清单不存在则从空开始
    }
    for (const n of names) {
        if (!lines.includes(n)) lines.unshift(n)
    }
    mkdirSync(dirname(listPath), { recursive: true })
    writeFileSync(listPath, lines.join('\n') + '\n')
}

// ---- 入口 ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (watchMode) {
    // 监视模式：需要交互终端（按任意键退出）
    if (!process.stdin.isTTY) {
        console.error('--watch 模式需要交互终端（TTY）')
        process.exit(1)
    }
    console.log(
        '监视模式：图片放入收件箱后会自动上传（新图就绪约需数秒），按任意键退出'
    )
    let exitRequested = false
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', () => {
        exitRequested = true // 任意键退出
    })

    void (async () => {
        while (!exitRequested) {
            const ready = collectReadyFiles()
            for (const file of ready) {
                if (exitRequested) break
                await uploadOne(file)
            }
            if (exitRequested) break
            await sleep(SCAN_INTERVAL_MS)
        }
        process.stdin.setRawMode(false)
        console.log(
            failed === 0 ? '监视结束 ✓' : `监视结束，但有 ${failed} 个失败项`
        )
        process.exit(failed === 0 ? 0 : 1)
    })()
} else {
    // 单次模式
    const files = collectAllFiles()
    if (files.length === 0) {
        if (usingDefaultInbox) {
            console.log('收件箱里没有图片，无需上传')
            process.exit(0)
        }
        console.error('输入里没有找到图片文件')
        process.exit(1)
    }

    void (async () => {
        for (const file of files) {
            try {
                await uploadOne(file)
            } catch (err) {
                failed++
                console.error(`${file}: 处理失败`, err)
            }
        }
        console.log(
            dryRun
                ? `(dry-run 完成，未上传。去掉 --dry-run 执行真实上传)`
                : failed === 0
                  ? `\n全部完成 ✓`
                  : `\n完成，但有 ${failed} 个失败项`
        )
        process.exit(failed === 0 ? 0 : 1)
    })()
}
