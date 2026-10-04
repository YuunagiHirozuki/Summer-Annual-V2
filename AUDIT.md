# V1 审计报告（Phase 0 + Phase 1）

> 生成于 2026-10-04。旧站代码已从工作区删除（保留在 git HEAD，快照副本在
> `%TEMP%\sa-v1-ref`）。本报告是 V2 重建的功能基线与问题清单。

## 1. 现状基线（Phase 0）

- 工作区状态：`src/`、`public/` 已全部删除（未提交）；新增未跟踪文件 `AGENTS.md`、`SKILL.md`、`.zcodeignore`、`AUDIT.md`。
- 远端：`origin = github.com/YuunagiHiroizuki/SummerAnnual-PW`（旧仓库）。目标新仓库：`Summer-Annual-V2`。
- `pnpm install` 状态：node_modules 已存在，pnpm 10.18.3 可用；`package.json` 无 `packageManager` 字段。
- `pnpm build` 当前必然失败（没有 `src/pages/`），属预期；V2 搭出骨架后恢复。
- 配置遗留：`astro.config.mjs` 的 `site` 仍是 `https://hirozuki.vercel.app`（旧 Vercel 部署）。

## 2. V1 功能清单（V2 必须覆盖或明确放弃）

| 功能 | V1 实现 | 备注 |
| --- | --- | --- |
| 首页 | 全屏 cover hero + 公告卡 + 文章列表前 6 篇 + 分页 | hero 文案硬编码在 Hero.astro |
| 文章列表分页 | `/` 为第 1 页，`/posts/2..N` 为后续页 | 置顶 pinned 优先，按 pubDate 降序 |
| 文章详情 | 卡片式正文 + 可选头图 + 标签 + 上/下篇导航 + 空评论区 | 右侧 xl 屏浮动 TOC |
| 导航 | 固定顶部，透明→滚动变实底，下滑隐藏；active 下划线动画 | ABOUT/CONTACT 为页内锚点 |
| About / Contact | 全宽 section（头像 + SNS 图标 / 邮箱） | 挂在每个页面底部 |
| BackToTop | 固定右下，靠近 footer 时上浮 | |
| 归档/相册/项目 | 三个占位空壳页 | V2 决定去留 |
| RSS / sitemap / MDX | 已配置 | RSS 链接有 bug（见 §6-1） |
| 站点数据 | `consts.ts`：Summer Annual / 签名句「凪の海、月と夕焼の夏空が，綺麗……」 | |

### 需保留的识别度元素（视觉资产）

- 深色蓝黑底 + 水色（aqua）强调的配色；全屏封面 hero；透明→实底的导航条；
- float+breathe 下滑按钮；卡片文章列表；日语签名句。

### V1 文章 front matter（V2 精简基线）

`title, description, pubDate, updatedDate, image, categories, tags, draft, pinned`
（`heroImage`、`slug` 两个字段在 V1 无实际消费方，建议废弃。）

## 3. CSS 审计（问题 / 位置 / 影响 / 建议）

1. **两套色板混杂**：`global.css:4-37` 同时存在旧 bearblog 亮色变量（`--light/--gray/--aqua/--transition`）、注释标着「AI加入」的暗色变量、以及 `--cyan/--blue/--yellow/--aqua-light2` 等无消费方的变量；`--surface/--surface2/--card` 与 `--border/--border2` 概念重复。影响：改色需要跨多处猜。建议：V2 只保留一套语义 token（bg/surface/border/text/text-muted/primary…）。
2. **引用未定义变量**：`global.css:118,154` 用 `rgb(var(--gray-light))`，但 `--gray-light` 从未定义 → code 背景与 hr 边框实际失效。建议：V2 建立变量清单，删除死变量。
3. **失效渐变 + 双重背景定义**：`--gray-gradient` 未定义，`global.css:73` 与 `Footer.astro:10` 内联样式都引用它；body 背景在 `:is(html,body)` 与 `body` 两条规则中定义两次且互相覆盖。建议：背景只在一处定义。
4. **Tailwind 灰阶与 CSS 变量两套颜色系统并用**：如 `PostLayout.astro:66-113` 的 `text-gray-500 / bg-gray-100 dark:bg-gray-800` 混在 `var(--*)` 之间。影响：视觉不一致、暗色逻辑分裂（站点本无明暗切换，却大量写 `dark:`）。建议：V2 明确「颜色只用 token」，Tailwind 只管布局间距。
5. **无效/错别字类名**：`About.astro:37` `text-[var(--)]`（空变量）、`About.astro:52` `text-gray`（不存在）、`TOC.astro:61` `--text-muted`（实际叫 `--text-dim`）。建议：清理；V2 用 prettier-plugin-tailwindcss 保持一致性。
6. **动态拼接 Tailwind 类名**：`TOC.astro:59` `ml-${(level-2)*2}` 运行时生成 `ml-0/2/4/6`，Tailwind 扫描不到 → 缩进样式丢失。建议：改用固定 class 映射或组件内 CSS。
7. **`!important` / 高特异性**：`About.astro:39` `!mb-10`；`BaseHead.astro` 为空文件但 `sr-only` 在 global.css 中用 `!important`。建议：V2 原则上禁用。

## 4. 结构与脚本问题

1. **`<html>` 双重嵌套（结构性错误）**：`PostLayout.astro:24` 自带 `<html><head>`，又在内部再包 `<Layout>`（后者也输出完整 `<html>`）。影响：DOM 非法、SEO 元数据位置混乱。建议：V2 只有 BaseLayout 拥有 `<html>`，ArticleLayout 只输出正文骨架。
2. **页面级 SEO 缺失**：`Layout.astro`/`PageLayout.astro` 的 `<head>` 无 title/description/OG/canonical；`BaseHead.astro` 是 0 字节空文件。影响：除文章页外全站无标题。建议：V2 恢复 BaseHead 能力并统一由 BaseLayout 挂载。
3. **全局函数 + 手动重初始化模式**：`Layout.astro:19-57` 的 `initGlobals` + `window.__myNavInit/__backToTopInit`，`Navbar.astro:74` 与 `BackToTop.astro:50` 在每次 `astro:after-swap` 后重复 `addEventListener('scroll')` 且从不解绑 → ClientRouter 切页几次后监听器累积。建议：V2 用 `<script>`（Astro 自动去重）+ `astro:page-load`，或 `transition:persist` 下只初始化一次。
4. **空组件仍被引用**：`SearchCard.astro`（0 字节，被 Navbar import）、`BaseHead.astro`（0 字节，被 PostLayout import）；Navbar 搜索按钮无功能。建议：V2 砍掉搜索或做成真功能。
5. **死代码**：`Layout.astro:9` 导入 `fade, slide` 未用；`[...slug].astro:47` 与 `PostLayout.astro:9` 的 `Content?.render?.()` 对组件对象无效（恒 undefined）；`[...slug].astro:49` 遗留 `console.log`；`[...page].astro:34-47` 重复声明 `interface PageProps` 且 `pageParam` 未用。
6. **滚动控制 hack**：`scroll-control.js` 点击时临时加/移除 `smooth-scroll` 类。建议：V2 直接 `html{scroll-behavior:smooth}` + `scroll-margin-top`，删除该脚本。

## 5. SEO / 可访问性

- heading 层级混乱：h1 只在 hero，页面标题用 h3，文章标题用 h2。
- Hero 用 `<a>` 包裹整屏 `<section>`，键盘语义差。
- 图片：列表/头图均为裸 `<img>` + 字符串 URL，未用 `astro:assets` 优化，`heroImage: image()` schema 字段闲置。

## 6. 内容管道问题

1. **slug 手术重复三处且有 bug**：`post.id.replace(/^posts\//,'').replace(/\.md$/,'')` 在 BlogList / [...slug] / getStaticPaths 各写一遍，且 `.mdx` 不被匹配 → MDX 文章 URL 带 `.mdx` 后缀；`rss.xml.js:13` 直接 `link: /posts/${post.id}/` → RSS 链接为 `/posts/posts/xxx.md/`，全坏。建议：V2 用 glob loader 的 `generateId` 统一产出 slug，全站只读 `post.id`。
2. **草稿机制**：V1 用自定义 `draft` 字段 + 手动 filter；AGENTS.md 期望 `published`。二选一，V1 机制可用即沿用（见决策点）。
3. **prev/next 取自未排序集合**：`[...slug].astro` 按集合原始顺序取上下篇（含草稿），日期会乱跳。建议：V2 用排序后的列表求上下篇。

## 7. 依赖

- `autoprefixer` + `postcss` 为死依赖（Tailwind v4 内置 lightningcss，且无 postcss.config）。
- `remark-toc`（在正文里插入静态 TOC）与客户端 TOC 组件是两套目录系统并存。建议 V2 只留一套（推荐客户端 TOC，删 remark-toc）。
- 其余（astro 5.17、@astrojs/mdx、sitemap、rss、astro-icon、tailwind v4、sharp）保留。

## 8. V2 需要拍板的决策点

| # | 决策 | 选项 | 推荐 |
| --- | --- | --- | --- |
| 1 | 路线 | A. 在本仓库全新搭建 V2（旧码只作参考）；B. 恢复旧码渐进重构 | **A**（src/public 已删空、AGENTS.md 指向 V2 新仓库、原项目已另备份） |
| 2 | 视觉基调 | A. 保留 V1 深色水色主题，重建为 token；B. 重新设计 | **A**（保住识别度，降低重设计成本） |
| 3 | 新仓库地址 | AGENTS.md 写 `YuunagiHirozuki/Summer-Annual-V2`，git 账号却是 `YuunagiHiroizuki`（少一个 i） | 需用户确认拼写；确认后切换 origin |
| 4 | 占位页去留 | archive / gallery / projects 三页在 V1 均为空壳 | 导航保留入口但 V2 先做结构+视觉，内容后填 |
| 5 | 草稿字段 | 沿用 `draft: true`；或改 `published: true` | 沿用 `draft`（已有机制，改动小） |
| 6 | 生产域名 | 现为 `hirozuki.vercel.app` | 可延后到部署阶段（Cloudflare Pages 域名确定后改 `astro.config.mjs`） |

## 9. V2 目标结构（Phase 2 起逐步成形）

```text
src/
├── components/        # Header.astro Footer.astro PostCard.astro Pagination.astro ...
├── layouts/
│   ├── BaseLayout.astro      # 唯一拥有 <html> 的层
│   └── ArticleLayout.astro
├── pages/             # index.astro posts/ archive.astro ...
├── styles/
│   ├── tokens.css     # 设计变量（颜色/字体/圆角/间距/内容宽度）
│   ├── base.css       # reset + 元素默认
│   └── prose.css      # Markdown 正文样式
└── content.config.ts  # content collections（glob loader，指向导入内容目录）
scripts/
└── import-content.mjs # Phase 5：从私有文章仓库导入 published 内容
```
