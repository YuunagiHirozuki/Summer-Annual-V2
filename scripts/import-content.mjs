#!/usr/bin/env node
// 从私有文章仓库导入已发布文章到 src/content/posts/
//
// 用法: node scripts/import-content.mjs <文章仓库本地路径>
//
// 文章仓库约定结构（由本脚本消费）：
//   posts/
//   ├── my-article/            ← 目录名即 slug
//   │   ├── index.md
//   │   └── images/            ← 仅复制常见图片格式
//   │       ├── cover.webp
//   │       └── image-01.webp
//   └── another-post/
//       └── index.md
//
// 规则（见 AGENTS.md §21）：
//   1. 只读取 posts/ 目录；drafts/ 等其他目录一律不碰
//   2. 只导入 front matter 里 draft 不为 true 的文章
//   3. 只复制 .md/.mdx 与图片文件，其他文件类型忽略
//   4. 已有同名文章会被覆盖（文章仓库为准），未导入的本地文章保持不动
//   5. 找不到文章仓库或没有可导入文章时，以非零码退出（构建失败要显眼）

import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'

const IMAGE_EXTENSIONS = new Set([
    '.webp',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.avif',
])

const repoPath = resolve(process.argv[2] ?? '')
const postsSource = join(repoPath, 'posts')
const destRoot = resolve('src/content/posts')

function fail(message) {
    console.error(`[import-content] 错误: ${message}`)
    process.exit(1)
}

if (!existsSync(postsSource)) {
    fail(`文章仓库路径不存在或缺少 posts/ 目录: ${repoPath}`)
}

/** 解析 front matter 的 draft 字段；缺失或解析失败时视为已发布 */
function isDraft(mdPath) {
    let text
    try {
        text = readFileSync(mdPath, 'utf8')
    } catch {
        return false
    }
    const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!block) return false
    const field = block[1].match(/^draft:\s*(true|false)\s*$/m)
    return field ? field[1] === 'true' : false
}

/** 复制 images/ 目录，只保留图片扩展名 */
function copyImages(imagesDir, destDir) {
    if (!existsSync(imagesDir)) return
    mkdirSync(destDir, { recursive: true })
    for (const name of readdirSync(imagesDir)) {
        const ext = extname(name).toLowerCase()
        if (!IMAGE_EXTENSIONS.has(ext)) continue
        cpSync(join(imagesDir, name), join(destDir, name))
    }
}

let imported = 0
let skippedDrafts = 0
const importedNames = []

for (const entry of readdirSync(postsSource)) {
    const entryPath = join(postsSource, entry)
    const stat = statSync(entryPath)

    if (stat.isDirectory()) {
        // 目录式：目录名即 slug，找 index.md / index.mdx
        const indexMd = join(entryPath, 'index.md')
        const indexMdx = join(entryPath, 'index.mdx')
        const source = existsSync(indexMd)
            ? indexMd
            : existsSync(indexMdx)
              ? indexMdx
              : null
        if (!source) continue

        if (isDraft(source)) {
            skippedDrafts++
            console.log(`[import-content] 跳过草稿: ${entry}`)
            continue
        }

        const destDir = join(destRoot, entry)
        mkdirSync(destDir, { recursive: true })
        writeFileSync(join(destDir, basename(source)), readFileSync(source))
        copyImages(join(entryPath, 'images'), join(destDir, 'images'))

        imported++
        importedNames.push(entry)
        console.log(`[import-content] 导入: ${entry}`)
    } else {
        // 单文件式：文件名（去扩展名）即 slug
        const ext = extname(entry).toLowerCase()
        if (ext !== '.md' && ext !== '.mdx') continue

        if (isDraft(entryPath)) {
            skippedDrafts++
            console.log(`[import-content] 跳过草稿: ${entry}`)
            continue
        }

        mkdirSync(destRoot, { recursive: true })
        writeFileSync(join(destRoot, entry), readFileSync(entryPath))

        imported++
        importedNames.push(basename(entry, ext))
        console.log(`[import-content] 导入: ${entry}`)
    }
}

if (imported === 0) {
    fail(`没有可导入的已发布文章（${postsSource}）。请检查文章仓库内容。`)
}

console.log(
    `[import-content] 完成: 导入 ${imported} 篇，跳过草稿 ${skippedDrafts} 篇 → ${destRoot}`
)
console.log(`[import-content] 文章: ${importedNames.join(', ')}`)
