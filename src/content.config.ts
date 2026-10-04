import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

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
            pubDate: z.coerce.date(),
            updatedDate: z.coerce.date().optional(),
            // 封面二选一：
            //   - 相对路径 './images/cover.webp' → 文章自带图片，走 astro:assets
            //   - 绝对路径 '/images/...' → public 公共路径，保持字符串
            // 不能直接把 image() 放进 union：它会连绝对路径一起当作待打包
            // 图片处理，导致构建失败，所以在这里按路径形态分流
            image: z
                .string()
                .optional()
                .transform((val) => {
                    if (!val || val.startsWith('/')) return val
                    return image().parse(val)
                }),
            categories: z.string().optional(),
            tags: z.array(z.string()).optional(),
            draft: z.boolean().default(false),
            pinned: z.boolean().default(false),
        }),
})

// 画廊作品：一个 md 文件对应一幅画，图片放同目录
const gallery = defineCollection({
    loader: glob({
        base: './src/content/gallery',
        pattern: ['**/*.md'],
        generateId,
    }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            image: image(),
            date: z.coerce.date().optional(),
            description: z.string().optional(),
        }),
})

export const collections = { posts, gallery }
