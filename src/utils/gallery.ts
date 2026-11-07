// 画廊图片来源：Cloudflare R2 bucket 的 gallery/ 目录
// 构建时通过 S3 兼容的 ListObjectsV2 列出对象（用 R2 API Token 签名，
// 见 .env.example 的变量说明）。缺少凭据或请求失败时返回空列表：
// 页面显示空态，不阻塞构建。

import { AwsClient } from 'aws4fetch'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface GalleryImage {
    /** 完整图片（网格与灯箱共用同一份） */
    src: string
    alt: string
    /** 上传时间戳：清单之外的图按它排在清单后面 */
    uploadedAt: number
    /** R2 对象的文件名（顺序清单按它匹配） */
    filename: string
}

/** 顺序清单：src/config/gallery-order.txt 每行一个文件名，
    从上到下 = 画廊展示顺序。由 gallery-upload.mjs 自动维护（新图置顶），
    手动编辑挪行即可自由调序。清单缺失时回退到上传时间排序 */
function readOrderList(): string[] {
    try {
        return readFileSync(
            join(process.cwd(), 'src/config/gallery-order.txt'),
            'utf8'
        )
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'))
    } catch {
        return []
    }
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i

const decodeXmlEntities = (s: string) =>
    s.replace(
        /&(amp|lt|gt|quot|apos);/g,
        (_, e: string) =>
            ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e] ?? e
    )

/** Astro 的 .env 只进 import.meta.env，CI 的 workflow env 只进 process.env，两边都读 */
function env(key: string): string | undefined {
    const fromImportMeta = (import.meta.env as Record<string, unknown>)[key]
    return (typeof fromImportMeta === 'string' ? fromImportMeta : undefined) ??
        process.env[key]
}

export async function getGalleryImages(): Promise<GalleryImage[]> {
    const accessKeyId = env('R2_ACCESS_KEY_ID')
    const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
    const accountId = env('CLOUDFLARE_ACCOUNT_ID')
    const bucket = env('R2_BUCKET')
    const publicBase = env('R2_PUBLIC_BASE')?.replace(/\/$/, '')

    if (
        !accessKeyId ||
        !secretAccessKey ||
        !accountId ||
        !bucket ||
        !publicBase
    ) {
        console.warn(
            '[gallery] 缺少 R2 环境变量（R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / CLOUDFLARE_ACCOUNT_ID / R2_BUCKET / R2_PUBLIC_BASE），画廊为空'
        )
        return []
    }

    const r2 = new AwsClient({ accessKeyId, secretAccessKey })
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
    const images: GalleryImage[] = []
    let continuation: string | undefined

    try {
        do {
            const url = new URL(endpoint)
            url.searchParams.set('list-type', '2')
            url.searchParams.set('prefix', 'gallery/')
            url.searchParams.set('max-keys', '1000')
            if (continuation) {
                url.searchParams.set('continuation-token', continuation)
            }

            const res = await r2.fetch(url.toString())
            if (!res.ok) {
                console.warn(
                    '[gallery] R2 列表请求失败:',
                    res.status,
                    (await res.text()).slice(0, 200)
                )
                return []
            }

            const xml = await res.text()
            for (const block of xml.matchAll(/<Contents>[\s\S]*?<\/Contents>/g)) {
                const entry = block[0]
                const keyMatch = entry.match(/<Key>([^<]+)<\/Key>/)
                if (!keyMatch) continue
                const key = decodeXmlEntities(keyMatch[1])
                if (!IMAGE_EXTENSIONS.test(key)) continue
                const filename = key.split('/').pop() ?? key
                const lastModified = entry.match(/<LastModified>([^<]+)<\/LastModified>/)
                images.push({
                    src: `${publicBase}/${key}`,
                    alt: decodeXmlEntities(filename.replace(IMAGE_EXTENSIONS, '')),
                    uploadedAt: lastModified
                        ? Date.parse(decodeXmlEntities(lastModified[1]))
                        : 0,
                    filename: filename,
                })
            }

            continuation = /<IsTruncated>true<\/IsTruncated>/.test(xml)
                ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1]
                : undefined
        } while (continuation)
    } catch (err) {
        console.warn('[gallery] R2 列表请求异常:', err)
        return []
    }

    // 排序：顺序清单在前（按清单行序，新的在左上）；
    // 清单之外的图按上传时间降序跟在后面；同刻按 key 数字感知降序裁决
    const orderIndex = new Map(
        readOrderList().map((n, i) => [n.toLowerCase(), i] as const)
    )
    return images.sort((a, b) => {
        const oa = orderIndex.get(a.filename.toLowerCase())
        const ob = orderIndex.get(b.filename.toLowerCase())
        if (oa !== undefined && ob !== undefined) return oa - ob
        if (oa !== undefined) return -1
        if (ob !== undefined) return 1
        if (a.uploadedAt !== b.uploadedAt) return b.uploadedAt - a.uploadedAt
        return b.src.localeCompare(a.src, undefined, { numeric: true })
    })
}
