// mermaid 图的缩放与拖拽。
// astro-mermaid 在客户端渲染（<pre class="mermaid"> → svg），且主题切换、
// ClientRouter 换页时会整体重渲染——这里用 MutationObserver 跟随重建。
// 只在图确实放不下容器时才启用缩放，小图保持安静。

type PanzoomInstance = {
    dispose: () => void
    smoothZoom: (x: number, y: number, factor: number) => void
    zoomAbs: (x: number, y: number, scale: number) => void
    moveTo: (x: number, y: number) => void
}

/** 处理记录：pre 元素 → 已处理的 svg（或 'plain' = 无需缩放）。svg 被重渲染替换后会重新处理 */
const processed = new WeakMap<HTMLElement, SVGSVGElement | 'plain'>()
const instances = new WeakMap<HTMLElement, PanzoomInstance>()

/** mermaid 把自然宽度写进 svg 的 max-width 样式（如 max-width: 1428px） */
function naturalWidth(svg: SVGSVGElement): number {
    const fromStyle = parseFloat(svg.style.maxWidth)
    if (!Number.isNaN(fromStyle) && fromStyle > 0) return fromStyle
    return svg.viewBox.baseVal.width || svg.getBoundingClientRect().width
}

function setup(pre: HTMLElement) {
    const svg = pre.querySelector<SVGSVGElement>('svg')
    if (!svg || processed.get(pre) === svg) return
    processed.set(pre, svg)

    pre.classList.add('mermaid-zoom-host')

    // 小图：撑满容器就看得清，不启用缩放
    if (naturalWidth(svg) <= pre.clientWidth + 2) {
        processed.set(pre, 'plain')
        return
    }

    void import('panzoom').then(({ default: panzoom }) => {
        // 等待加载期间图可能被重渲染过
        if (processed.get(pre) !== svg) return
        instances.get(pre)?.dispose()

        const instance = panzoom(svg, {
            maxZoom: 4,
            minZoom: 1,
            zoomDoubleClickSpeed: 1,
            // 普通滚轮保持页面滚动；按住 Ctrl/Cmd 才是缩放
            beforeWheel: (event) => {
                const wheel = event as WheelEvent
                return !(wheel.ctrlKey || wheel.metaKey)
            },
        })
        instances.set(pre, instance)

        const markZoomed = () => {
            pre.classList.toggle('mermaid-zoomed', instance.getTransform().scale > 1.01)
        }
        // zoom：按钮/Ctrl+滚轮缩放；pan：拖拽平移。两处都要同步状态
        instance.on('zoom', markZoomed)
        instance.on('pan', () => {
            // 未放大时禁止平移（拖拽自动回弹到撑满状态）
            const t = instance.getTransform()
            if (t.scale <= 1.001 && (t.x !== 0 || t.y !== 0)) {
                instance.moveTo(0, 0)
            }
            markZoomed()
        })

        // 工具条：放大 / 缩小 / 重置
        const bar = document.createElement('div')
        bar.className = 'mermaid-zoom-bar'
        const button = (label: string, title: string, action: () => void) => {
            const b = document.createElement('button')
            b.type = 'button'
            b.textContent = label
            b.title = title
            b.addEventListener('click', action)
            bar.appendChild(b)
        }
        button('＋', '放大', () => instance.smoothZoom(pre.clientWidth / 2, 20, 1.3))
        button('－', '缩小', () => instance.smoothZoom(pre.clientWidth / 2, 20, 1 / 1.3))
        button('↺', '重置', () => {
            instance.moveTo(0, 0)
            instance.zoomAbs(0, 0, 1)
        })
        pre.appendChild(bar)
    })
}

let scheduled = false
function scan() {
    scheduled = false
    document.querySelectorAll<HTMLElement>('pre.mermaid').forEach((pre) => {
        if (pre.querySelector('svg')) setup(pre)
    })
}

const STYLE = `
pre.mermaid.mermaid-zoom-host { position: relative; overflow: hidden; }
pre.mermaid.mermaid-zoomed svg { cursor: grab; }
pre.mermaid.mermaid-zoomed:active svg { cursor: grabbing; }
.mermaid-zoom-bar {
    position: absolute; top: 8px; right: 8px;
    display: flex; gap: 4px; z-index: 5;
}
.mermaid-zoom-bar button {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; line-height: 1;
    color: var(--ink); background: var(--surface);
    border: 1px solid var(--border); border-radius: 4px;
    cursor: pointer;
}
.mermaid-zoom-bar button:hover { color: var(--aqua); border-color: var(--aqua); }
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
start()
