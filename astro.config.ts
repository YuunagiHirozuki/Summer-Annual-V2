import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import icon from 'astro-icon'
import remarkBreaks from 'remark-breaks'
import mermaid from 'astro-mermaid'

// https://astro.build/config
export default defineConfig({
    // 以后若绑定自定义域名，只需改这一行
    site: 'https://summer-annual.pages.dev',
    output: 'static',
    integrations: [
        mdx(),
        sitemap(),
        icon(),
        mermaid({ theme: 'dark', autoTheme: true }),
    ],

    image: {
        // 直通服务：所有图片（Hero、封面、正文）原样输出、不缩放
        // 恢复压缩：删掉这个 image 配置块即可回到 sharp 管线
        service: { entrypoint: 'astro/assets/services/noop' },
    },

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
