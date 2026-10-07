const languageNames: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    md: 'Markdown',
    markdown: 'Markdown',
    py: 'Python',
    python: 'Python',
    sh: 'Shell',
    shell: 'Shell',
    bash: 'Bash',
    git: 'Git',
}

function initCodeBlocks() {
    document.querySelectorAll<HTMLPreElement>('.md-content pre').forEach((pre) => {
        if (pre.dataset.toolbar) return
        pre.dataset.toolbar = '1'

        const code = pre.querySelector('code')

        const rawLang =
            pre.getAttribute('data-language') ||
            code?.className.match(/language-([\w-]+)/)?.[1] ||
            ''

        const lang =
            rawLang.toLowerCase() === 'plaintext'
                ? ''
                : rawLang

        const displayLang =
            languageNames[lang.toLowerCase()] ?? lang

        const wrapper = document.createElement('div')
        wrapper.className = 'code-block'

        const header = document.createElement('div')
        header.className = 'code-header'

        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'code-copy'
        btn.setAttribute('aria-label', '复制')

        // 有语言：显示语言名
        // 无语言：显示复制图标
        const hasLanguage = Boolean(displayLang)

        const resetButton = () => {
            btn.innerHTML = hasLanguage
                ? `<span class="code-lang">${displayLang}</span>`
                : '<i class="mi-copy"></i>'
        }
        
        resetButton()

        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code?.innerText ?? '')
                btn.innerHTML = '<i class="mi-check"></i>'
            } catch {
                btn.innerHTML = '<i class="mi-warning"></i>'
            }

            setTimeout(resetButton, 1500)
        })

        header.appendChild(btn)

        pre.replaceWith(wrapper)
        wrapper.appendChild(header)
        wrapper.appendChild(pre)
    })
}

document.addEventListener('astro:page-load', initCodeBlocks)