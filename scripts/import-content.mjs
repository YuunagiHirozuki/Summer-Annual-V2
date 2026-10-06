#!/usr/bin/env node
// 从私有文章仓库导入文章：目录即分类
//
// 文章仓库结构（一级目录 = 分类名）：
//   技术/
//   ├── Astro/                  ← 组织用子目录（不影响任何东西）
//   │   └── astro-image/        ← 文章文件夹（目录名 = slug）
//   │       ├── index.md
//   │   │   └── images/
//   ├── another-post/           ← 分类目录里直接放文章也属于该分类
//   │   └── index.md
//   ├── my-note.md             ← 分类目录里的平铺 md
//   ├── my-post/               ← 根目录直放的文章文件夹 = 无分类
//   └── my-note.md             ← 根目录平铺 md = 无分类
//
// 规则（见 AGENTS.md §21）：
//   1. drafts/、.开头目录、_开头文件、README.md 一律不导入
//   2. draft: true 的文章跳过
//   3. 分类从一级目录名推导，导入时自动注入 front matter（无需手填）
//   4. slug = 文章文件夹名（或平铺文件名），全仓库必须唯一
//   5. 只复制 md/mdx 与图片
//   6. slug 重复或找不到任何文章时，以非零码退出（构建失败要显眼）

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
const MD_EXTENSIONS = new Set(['.md', '.mdx'])
const SKIP_DIRS = new Set([
    'drafts',
    'node_modules',
    '.git',
    '.github',
    '.obsidian',
    '.vscode',
])

const repoPath = resolve(process.argv[2] ?? '')
const destRoot = resolve('src/content/posts')

function fail(message) {
    console.error(`[import-content] 错误: ${message}`)
    process.exit(1)
}

if (!existsSync(repoPath)) {
    fail(`文章仓库路径不存在: ${repoPath}`)
}

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

/** 把分类注入 front matter：文件夹结构是分类的唯一权威来源 */
function applyCategory(text, category) {
    if (!category) {
        return text.replace(/^categories:.*\r?\n/m, '')
    }
    if (/^categories:[^\n]*$/m.test(text)) {
        return text.replace(/^categories:[^\n]*$/m, `categories: ${category}`)
    }
    const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---/)
    if (!fm) return text // 无 front matter 的文章交给 schema 校验报错
    return text.replace(
        /^(---\r?\n[\s\S]*?)\r?\n---/,
        `$1\ncategories: ${category}\n---`
    )
}

const articles = [] // { dir?|file?, slug, category }

const isArticleDir = (dir) =>
    existsSync(join(dir, 'index.md')) || existsSync(join(dir, 'index.mdx'))

/** 递归收集：含 index.md 的目录 = 文章，否则继续深入（组织目录） */
function collect(dir, category) {
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue
        const full = join(dir, entry)
        if (!statSync(full).isDirectory()) {
            const ext = extname(entry).toLowerCase()
            if (MD_EXTENSIONS.has(ext)) {
                articles.push({
                    file: full,
                    slug: basename(entry, extname(entry)).replace(/\s+/g, '-'),
                    category,
                    ext,
                })
            }
            continue
        }
        if (isArticleDir(full)) {
            articles.push({
                dir: full,
                slug: entry.replace(/\s+/g, '-'),
                category,
                indexName: existsSync(join(full, 'index.md'))
                    ? 'index.md'
                    : 'index.mdx',
            })
        } else {
            collect(full, category)
        }
    }
}

// ===== 顶层遍历：一级目录 = 分类，根目录直放 = 无分类 =====
for (const entry of readdirSync(repoPath)) {
    if (entry.startsWith('.') || entry.startsWith('_')) continue
    if (SKIP_DIRS.has(entry)) continue
    if (entry === 'README.md') continue

    const full = join(repoPath, entry)

    if (!statSync(full).isDirectory()) {
        const ext = extname(entry).toLowerCase()
        if (MD_EXTENSIONS.has(ext)) {
            articles.push({
                file: full,
                slug: basename(entry, extname(entry)).replace(/\s+/g, '-'),
                category: null,
                ext,
            })
        }
        continue
    }

    if (isArticleDir(full)) {
        // 根目录直放的文章文件夹 = 无分类
        articles.push({
            dir: full,
            slug: entry.replace(/\s+/g, '-'),
            category: null,
            indexName: existsSync(join(full, 'index.md'))
                ? 'index.md'
                : 'index.mdx',
        })
        continue
    }

    // 一级目录 = 分类
    collect(full, entry)
}

if (articles.length === 0) {
    fail(`没有找到任何文章（${repoPath}）。请检查文章仓库结构。`)
}

// ===== 过滤草稿 + 查重 =====
const usedSlugs = new Set()
const queue = [] // 待导入
let skippedDrafts = 0

for (const article of articles) {
    const mdPath =
        article.dir !== undefined
            ? join(article.dir, article.indexName)
            : article.file
    if (isDraft(mdPath)) {
        skippedDrafts++
        console.log(`[import-content] 跳过草稿: ${article.slug}`)
        continue
    }
    if (usedSlugs.has(article.slug)) {
        fail(`slug 重复: "${article.slug}"。文章文件夹名（或平铺文件名）全仓库必须唯一。`)
    }
    usedSlugs.add(article.slug)
    queue.push(article)
}

// ===== 复制 =====
let imported = 0
const importedNames = []
function copyImages(imagesDir, destDir) {
    if (!existsSync(imagesDir)) return
    mkdirSync(destDir, { recursive: true })
    for (const name of readdirSync(imagesDir)) {
        if (!IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) continue
        // 不用 cpSync：Windows 上它对含中文的源路径 + \?\ 扩展路径有缺陷
        writeFileSync(join(destDir, name), readFileSync(join(imagesDir, name)))
    }
}

function inject(text, category) {
    if (!category) {
        // 无分类：移除手填的 categories 行（文件夹结构才是权威）
        return text.replace(/^categories:.*\r?\n/m, '')
    }
    if (/^categories:[^\n]*$/m.test(text)) {
        return text.replace(/^categories:[^\n]*$/m, `categories: ${category}`)
    }
    const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---/)
    if (!fm) return text // 无 front matter 交给 schema 校验报错
    return text.replace(
        /^(---\r?\n[\s\S]*?)\r?\n---/,
        `$1\ncategories: ${category}\n---`
    )
}

mkdirSync(destRoot, { recursive: true })

for (const article of queue) {
    const destDir = join(destRoot, article.slug)
    mkdirSync(destDir, { recursive: true })

    if (article.dir !== undefined) {
        const source = join(article.dir, article.indexName)
        const text = inject(readFileSync(source, 'utf8'), article.category)
        writeFileSync(join(destDir, article.indexName), text)
        copyImages(join(article.dir, 'images'), join(destDir, 'images'))
    } else {
        const text = inject(readFileSync(article.file, 'utf8'), article.category)
        writeFileSync(join(destRoot, article.slug + article.ext), text)
    }

    imported++
    importedNames.push(
        `${article.slug}${article.category ? `（${article.category}）` : '（无分类）'}`
    )
    console.log(
        `[import-content] 导入: ${article.slug}${article.category ? ` [${article.category}]` : ''}`
    )
}

console.log(
    `[import-content] 完成: 导入 ${imported} 篇，跳过草稿 ${skippedDrafts} 篇 → ${destRoot}`
)
console.log(`[import-content] 文章: ${importedNames.join(', ')}`)
