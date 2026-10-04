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
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        image: z.string().optional(),
        categories: z.string().optional(),
        tags: z.array(z.string()).optional(),
        draft: z.boolean().default(false),
        pinned: z.boolean().default(false),
    }),
})

export const collections = { posts }
