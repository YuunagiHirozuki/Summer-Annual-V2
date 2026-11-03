import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import icon from 'astro-icon'
import remarkBreaks from 'remark-breaks'

// https://astro.build/config
export default defineConfig({
    // 以后若绑定自定义域名，只需改这一行
    site: 'https://summer-annual.pages.dev',
    output: 'static',
    integrations: [mdx(), sitemap(), icon()],

    vite: {
        plugins: [tailwindcss()],
        define: {
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        },
    },
    markdown: {
        // Astro 7 默认使用 Sätteri 处理器；remark/rehype 插件需通过 unified() 显式传入
        processor: unified({
            remarkPlugins: [remarkBreaks],
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
        }),
    },
})
