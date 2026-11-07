// mermaid 图的全屏预览（lightbox 式，PhotoSwipe 交互）：
// 大图在正文里被缩到容器宽度看不清——点击图打开全屏覆盖层，
// 图按屏幕适配居中，滚轮/拖拽/双指缩放平移，ESC / ✕ / 点空白关闭。
// astro-mermaid 重渲染、主题切换、ClientRouter 换页由 MutationObserver 跟随。

const processed = new WeakMap<HTMLElement, SVGSVGElement | 'plain'>()
let overlay: HTMLElement | null = null
let escListener: ((event: KeyboardEvent) => void) | null = null

/** mermaid 把自然宽度写进 svg 的 max-width 样式（如 max-width: 1766px） */
function naturalSize(svg: SVGSVGElement) {
    const fromStyle = parseFloat(svg.style.maxWidth)
    const width =
        !Number.isNaN(fromStyle) && fromStyle > 0
            ? fromStyle
            : svg.viewBox.baseVal.width || 640
    const vb = svg.viewBox.baseVal
    const height = vb.width > 0 ? (width / vb.width) * vb.height : width * 0.75
    return { width, height }
}

function setup(pre: HTMLElement) {
    const svg = pre.querySelector<SVGSVGElement>('svg')
    if (!svg || processed.get(pre) === svg) return
    processed.set(pre, svg)

    // 小图：撑满容器就看得清，不启用全屏预览
    if (naturalSize(svg).width <= pre.clientWidth + 2) {
        processed.set(pre, 'plain')
        return
    }

    pre.classList.add('mermaid-zoomable')
    pre.addEventListener('click', () => openLightbox(pre))
}

function openLightbox(pre: HTMLElement) {
    if (overlay) return
    const source = pre.querySelector<SVGSVGElement>('svg')
    if (!source) return

    // 克隆进覆盖层（不移动节点，避免和 astro-mermaid 的重渲染打架）
    const { width, height } = naturalSize(source)
    const fit = Math.min((innerWidth - 32) / width, (innerHeight - 32) / height, 1)
    const clone = source.cloneNode(true) as SVGSVGElement
    clone.removeAttribute('style')
    clone.style.width = `${Math.round(width * fit)}px`
    clone.style.height = `${Math.round(height * fit)}px`

    overlay = document.createElement('div')
    overlay.className = 'mermaid-lightbox'
    const holder = document.createElement('div')
    holder.className = 'mermaid-lightbox-holder'
    holder.appendChild(clone)
    overlay.appendChild(holder)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'mermaid-lightbox-close'
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('aria-label', '关闭预览')
    overlay.appendChild(closeBtn)

    document.body.appendChild(overlay)
    document.body.style.overflow = 'hidden' // 锁背景滚动

    const close = () => closeLightbox()
    closeBtn.addEventListener('click', close)
    overlay.addEventListener('click', (event) => {
        // 点图本身不关闭，点空白处关闭
        const target = event.target as Node | null
        if (target !== clone && !(target && clone.contains(target))) close()
    })
    escListener = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', escListener)

    void import('panzoom').then(({ default: panzoom }) => {
        if (!overlay) return // 覆盖层已被关闭
        panzoom(clone, {
            maxZoom: 12,
            minZoom: 1, // 1 = 适配屏幕的初始状态
            zoomDoubleClickSpeed: 1,
        })
    })
}

function closeLightbox() {
    if (!overlay) return
    overlay.remove()
    overlay = null
    document.body.style.overflow = ''
    if (escListener) {
        document.removeEventListener('keydown', escListener)
        escListener = null
    }
}

let scheduled = false
function scan() {
    scheduled = false
    document.querySelectorAll<HTMLElement>('pre.mermaid').forEach((pre) => {
        if (pre.querySelector('svg')) setup(pre)
    })
}

const STYLE = `
pre.mermaid.mermaid-zoomable { cursor: zoom-in; }
.mermaid-lightbox {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0, 0, 0, 0.92);
    display: flex; align-items: center; justify-content: center;
}
.mermaid-lightbox-holder {
    width: 100%; height: 100%; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
}
.mermaid-lightbox svg { display: block; }
.mermaid-lightbox-close {
    position: absolute; top: 16px; right: 16px; z-index: 10;
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #fff; background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 999px;
    cursor: pointer;
}
.mermaid-lightbox-close:hover { background: rgba(255, 255, 255, 0.18); }
`

function injectStyle() {
    if (document.getElementById('mermaid-zoom-style')) return
    const style = document.createElement('style')
    style.id = 'mermaid-zoom-style'
    style.textContent = STYLE
    document.head.appendChild(style)
}

const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(scan)
})

function start() {
    injectStyle()
    observer.observe(document.body, { childList: true, subtree: true })
    scan()
}

document.addEventListener('astro:page-load', start) // ClientRouter 换页后重新扫描
document.addEventListener('astro:before-swap', closeLightbox) // 换页时若开着预览则关闭
start()
