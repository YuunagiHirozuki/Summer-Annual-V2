import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

/** 纯日期字符串（无时间部分）一律被 JS 解析为 UTC 零点，在 +8 时区会显示成 08:00。
    检测 UTC 零点并改写为同一日历日的本地零点，让 formatDate 能区分纯日期与带时分两种写法 */
function normalizeDateOnly(d: Date): Date {
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
    return d
}

// id 生成规则：取文件名去掉扩展名；目录式文章（xxx/index.md）用目录名；空格转连字符
function generateId({ entry }: { entry: string }): string {
    const withoutExt = entry.replace(/\.(md|mdx)$/, '')
    const parts = withoutExt.split('/')
    const last = parts[parts.length - 1]
    const name =
        last === 'index' && parts.length >= 2 ? parts[parts.length - 2] : last
    return name.toLowerCase().replace(/\s+/g, '-')
}

const posts = defineCollection({
    loader: glob({
        base: './src/content/posts',
        pattern: ['**/*.md', '**/*.mdx'],
        generateId,
    }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            description: z.string(),
            pubDate: z.coerce.date().transform(normalizeDateOnly),
            updatedDate: z.coerce
                .date()
                .optional()
                .transform((d) => (d ? normalizeDateOnly(d) : undefined)),
            // 封面二选一：
            //   - 相对路径 './images/cover.webp' → 文章自带图片，走 astro:assets
            //   - 绝对路径 '/images/...' → public 公共路径，保持字符串
            // 不能直接把 image() 放进 union：它会连绝对路径一起当作待打包
            // 图片处理，导致构建失败，所以在这里按路径形态分流
            image: z
                .string()
                .nullable()
                .optional()
                .transform((val) => {
                    if (!val || val.startsWith('/')) return val
                    return image().parse(val)
                }),
            categories: z.string().optional(),
            tags: z.preprocess(
                (val) => (val == null || val === '' ? [] : val),
                z.array(z.string()).default([])
            ),
            draft: z.boolean().default(false),
            pinned: z.boolean().default(false),
        }),
})

export const collections = { posts }
