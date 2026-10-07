import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import expressiveCode from 'astro-expressive-code'
import icon from 'astro-icon'

// https://astro.build/config
export default defineConfig({
    // 以后若绑定自定义域名，只需改这一行
    site: 'https://summer-annual.pages.dev',
    output: 'static',
    integrations: [
        expressiveCode({
            themes: ['one-dark-pro'],
            styleOverrides: {
                borderRadius: '16px',
                codeBorderRadius: '0',
                codeFontSize: '0.875rem',
                codeLineHeight: '1.7',
                codePadding: '1.1em 1.4em',
                borderColor: 'var(--border)',
                codeBorderColor: 'var(--border)',
            },
        }),
        mdx(),
        sitemap(),
        icon(),
    ],

    vite: {
        plugins: [tailwindcss()],
    },
    markdown: {
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
