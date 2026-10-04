// 画廊图片来源：Cloudflare R2 bucket 的 gallery/ 目录
// 构建时通过 S3 兼容的 ListObjectsV2 列出对象（用 R2 API Token 签名，
// 见 .env.example 的变量说明）。缺少凭据或请求失败时返回空列表：
// 页面显示空态，不阻塞构建。

import { AwsClient } from 'aws4fetch'

export interface GalleryImage {
    src: string
    alt: string
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i

const decodeXmlEntities = (s: string) =>
    s.replace(
        /&(amp|lt|gt|quot|apos);/g,
        (_, e: string) =>
            ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e] ?? e
    )

export async function getGalleryImages(): Promise<GalleryImage[]> {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const bucket = process.env.R2_BUCKET
    const publicBase = process.env.R2_PUBLIC_BASE?.replace(/\/$/, '')

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
            for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
                const key = decodeXmlEntities(match[1])
                if (!IMAGE_EXTENSIONS.test(key)) continue
                const filename = key.split('/').pop() ?? key
                images.push({
                    src: `${publicBase}/${key}`,
                    alt: decodeXmlEntities(filename.replace(IMAGE_EXTENSIONS, '')),
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

    // 按 key 降序：编号大的（最新的）排前面
    return images.sort((a, b) =>
        b.src.localeCompare(a.src, undefined, { numeric: true })
    )
}
