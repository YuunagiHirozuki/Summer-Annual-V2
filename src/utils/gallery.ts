// 画廊图片来源：Cloudflare R2 bucket 的 gallery/ 目录
// 构建时通过 Cloudflare API 列出对象（见 .env.example 的四个变量）。
// 缺少凭据或请求失败时返回空列表：页面显示空态，不阻塞构建。

export interface GalleryImage {
    src: string
    alt: string
    uploadedAt?: string
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i

export async function getGalleryImages(): Promise<GalleryImage[]> {
    const token = process.env.CLOUDFLARE_API_TOKEN
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const bucket = process.env.R2_BUCKET
    const publicBase = process.env.R2_PUBLIC_BASE?.replace(/\/$/, '')

    if (!token || !accountId || !bucket || !publicBase) {
        console.warn(
            '[gallery] 缺少 R2 环境变量（CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / R2_BUCKET / R2_PUBLIC_BASE），画廊为空'
        )
        return []
    }

    const images: GalleryImage[] = []
    let cursor: string | undefined

    try {
        do {
            const url = new URL(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects`
            )
            url.searchParams.set('prefix', 'gallery/')
            url.searchParams.set('per_page', '1000')
            if (cursor) url.searchParams.set('cursor', cursor)

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = (await res.json()) as {
                success?: boolean
                errors?: unknown
                result?: Array<{ key: string; last_modified?: string }>
                result_info?: { cursor?: string; is_truncated?: boolean }
            }
            if (!res.ok || !json.success) {
                console.warn('[gallery] R2 列表请求失败:', json.errors ?? res.status)
                return []
            }

            for (const obj of json.result ?? []) {
                if (!IMAGE_EXTENSIONS.test(obj.key)) continue
                const filename = obj.key.split('/').pop() ?? obj.key
                images.push({
                    src: `${publicBase}/${obj.key}`,
                    alt: filename.replace(IMAGE_EXTENSIONS, ''),
                    uploadedAt: obj.last_modified,
                })
            }

            cursor = json.result_info?.is_truncated
                ? json.result_info.cursor
                : undefined
        } while (cursor)
    } catch (err) {
        console.warn('[gallery] R2 列表请求异常:', err)
        return []
    }

    // 按对象 key 排序：文件名编号即展示顺序
    return images.sort((a, b) =>
        a.src.localeCompare(b.src, undefined, { numeric: true })
    )
}
