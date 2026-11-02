// 画廊图片来源：Cloudflare R2 bucket 的 gallery/ 目录
// 构建时通过 S3 兼容的 ListObjectsV2 列出对象（用 R2 API Token 签名，
// 见 .env.example 的变量说明）。缺少凭据或请求失败时返回空列表：
// 页面显示空态，不阻塞构建。

import { AwsClient } from 'aws4fetch'

export interface GalleryImage {
    /** 预览版（宽 1200px，网格加载用） */
    src: string
    /** 全图版（宽 2560px，灯箱点开时才加载） */
    full: string
    alt: string
    /** 上传时间戳：排序用，新的在前 */
    uploadedAt: number
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
                const fullKey = key.replace('gallery/', 'gallery-full/')
                const lastModified = entry.match(/<LastModified>([^<]+)<\/LastModified>/)
                images.push({
                    src: `${publicBase}/${key}`,
                    full: `${publicBase}/${fullKey}`,
                    alt: decodeXmlEntities(filename.replace(IMAGE_EXTENSIONS, '')),
                    uploadedAt: lastModified
                        ? Date.parse(decodeXmlEntities(lastModified[1]))
                        : 0,
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

    // 新的在前（上传时间降序）；同一时刻按 key 的数字感知降序稳定裁决
    return images.sort((a, b) => {
        if (a.uploadedAt !== b.uploadedAt) return b.uploadedAt - a.uploadedAt
        return b.src.localeCompare(a.src, undefined, { numeric: true })
    })
}
