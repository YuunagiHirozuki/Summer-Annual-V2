// @ts-check

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import remarkToc from 'remark-toc'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import icon from 'astro-icon'

// https://astro.build/config
export default defineConfig({
    site: 'https://hirozuki.vercel.app',
    output: 'static',
    integrations: [mdx(), sitemap(), icon()],

    vite: {
        plugins: [tailwindcss()],
    },
    markdown: {
        remarkPlugins: [remarkToc],
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
