import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import icon from 'astro-icon'

// https://astro.build/config
export default defineConfig({
    // 以后若绑定自定义域名，只需改这一行
    site: 'https://summer-annual.pages.dev',
    output: 'static',
    integrations: [mdx(), sitemap(), icon()],

    vite: {
        plugins: [tailwindcss()],
    },
    markdown: {
        shikiConfig: {
            // 深色代码块在两种站点主题下都保持可读
            theme: 'one-dark-pro',
        },
        rehypePlugins: [
            rehypeSlug, // 给所有标题自动添加 id
            [
                rehypeAutolinkHeadings, // 给标题加锚点
                {
                    behavior: 'append',
                    properties: { class: 'heading-anchor' },
                },
            ],
        ],
    },
})
