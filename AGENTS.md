# AGENTS.md

## 1. 项目定位

这是一个个人网站项目，基于 **Astro + Tailwind CSS** 构建，并可能混合使用原生 CSS、Markdown / MDX 以及 Astro Components。

由于本项目需要重构，这是一份用于重构的复制品，原项目已经进行备份保存，请连接到新的仓库地址为https://github.com/YuunagiHirozuki/Summer-Annual-V2，忽视项目原先已有的git数据

本项目目前已经可以正常运行，但经过长期迭代后存在以下问题：

* Tailwind CSS 与原生 CSS 混用，样式职责不清；
* 存在重复、覆盖、特异性过高以及难以维护的 CSS；
* 部分页面和组件的视觉风格不统一；
* 部分组件之间存在样式耦合；
* 网站源码与文章内容、文章图片逐渐混杂；
* 部分历史代码可能已经没有实际使用价值。

本次工作是一次**渐进式重构 + 视觉重设计**。

目标不是单纯“把代码改得更现代”，而是在保持网站功能完整的前提下：

1. 建立清晰、可维护的前端样式体系；
2. 统一网站视觉设计；
3. 降低 CSS 修改成本；
4. 改善 Astro 页面与组件结构；
5. 将文章内容与网站源码解耦；
6. 为未来使用 Obsidian + Markdown 管理文章提供良好基础；
7. 使用 pnpm 管理依赖；
8. 使用 Cloudflare Pages 进行最终部署；
9. 保持项目简单，不为了所谓工程化而过度设计。

---

# 2. 核心原则

## 2.1 先理解，再修改

不要在没有理解现有代码的情况下直接大规模修改。

在开始重构前：

* 阅读 `package.json`；
* 确认 Astro、Tailwind、Markdown / MDX 等版本；
* 阅读项目目录结构；
* 检查 Astro 页面；
* 检查 Astro Components；
* 检查可能存在的客户端框架组件；
* 检查全局 CSS；
* 检查 Tailwind 配置；
* 检查 Astro 配置；
* 检查内容加载方式；
* 检查静态资源目录；
* 确认当前项目可以正常 `pnpm build`。

如果发现项目实际结构与本文件描述不一致：

**以实际项目代码为准，不要机械套用本文件中的目录结构。**

---

# 3. 技术栈原则

默认继续使用：

* Astro
* Tailwind CSS
* 当前项目已经使用的 Markdown / MDX 方案
* 当前项目已经使用的 Astro 集成
* 当前项目已经存在的客户端框架（如果确实有）
* pnpm

除非存在明确技术问题，否则不要因为个人偏好直接：

* 更换 Astro；
* 更换构建工具；
* 更换 CSS 框架；
* 更换 Markdown / MDX 方案；
* 引入大型 UI 框架；
* 引入复杂状态管理；
* 把 Astro 项目改造成 SPA；
* 重写整个项目。

---

# 4. Astro 使用原则

## 4.1 优先使用 Astro 原生能力

这是 Astro 项目。

对于静态内容、页面布局、文章页面等，优先使用：

* `.astro` Components；
* Astro layouts；
* Astro content / Markdown / MDX；
* Astro 的静态生成能力；
* Astro 原生路由。

不要为了习惯 Vue / React 的开发方式，把整个网站变成客户端 SPA。

---

## 4.2 不要无意义地引入客户端 TypeScript

Astro 的优势之一是默认尽可能少发送 TypeScript。

对于不需要交互的内容：

**优先使用静态 HTML。**

只有真正需要客户端交互时，才使用客户端 TypeScript 或现有的框架组件(尽量使用TypeScript，除非JavaScript效果更好更容易实现)。

不要为了：

* Tabs；
* 简单展开 / 收起；
* 简单菜单；
* 简单主题切换；
* 简单交互；

就随意引入大型客户端依赖。

具体实现应该根据项目实际情况决定。

---

## 4.3 不要为了“组件化”而组件化

Astro Components 应该按照实际职责拆分。

例如：

```text
src/
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── Card.astro
│   └── ...
│
├── layouts/
│   ├── BaseLayout.astro
│   └── ArticleLayout.astro
│
├── pages/
│   ├── index.astro
│   ├── posts/
│   └── ...
│
└── styles/
```

这只是参考。

不要为了形式上的“架构完整”创建大量只有几行代码的组件。

---

# 5. 包管理器规范

本项目统一使用 **pnpm**。

不要混用 npm、yarn、bun 等包管理器。

优先使用：

```bash
pnpm install
pnpm dev
pnpm build
```

如果项目存在对应脚本，则使用：

```bash
pnpm lint
pnpm test
pnpm typecheck
```

具体命令必须以 `package.json` 中实际存在的 scripts 为准。

---

## 5.1 Lockfile

项目使用：

```text
pnpm-lock.yaml
```

必须提交到 Git。

不要删除 `pnpm-lock.yaml` 来解决依赖问题。

如果需要重新生成或升级依赖，应明确说明原因。

---

## 5.2 CI 环境

CI 环境应该使用与本地一致的 pnpm 版本。

优先通过 `package.json` 的：

```json
{
  "packageManager": "pnpm@..."
}
```

锁定 pnpm 版本。

不要未经确认随意升级 pnpm。

---

# 6. Git 与修改纪律

## 6.1 每个阶段都应该保持可回滚

在进行较大修改前确认 Git 工作区状态。

建议按照以下阶段提交：

```text
chore: establish baseline
refactor: clean up styles
refactor: establish design tokens
refactor: rebuild shared components
refactor: redesign home page
refactor: redesign article page
refactor: redesign remaining pages
chore: remove legacy styles
chore: finalize content pipeline
chore: configure cloudflare deployment
```

不要求严格使用这些 commit message，但每个阶段应该具有清晰边界。

---

## 6.2 不要一次性修改整个项目

大型修改应该拆成多个阶段。

推荐顺序：

1. 项目审计
2. CSS 审计
3. 设计系统 / Design Tokens
4. 基础组件
5. Layout
6. 首页
7. 文章相关页面
8. 其他页面
9. 全站回归
10. 清理旧代码
11. 内容仓库分离
12. 构建与部署

每完成一个阶段：

* 运行检查；
* 确认没有明显问题；
* 再进入下一阶段。

---

# 7. CSS 架构规范

## 7.1 Tailwind 与原生 CSS 可以共存，但必须明确职责

本项目**不要求彻底删除 Tailwind，也不要求彻底删除原生 CSS**。

推荐职责：

### Tailwind

主要用于：

* flex / grid；
* padding / margin；
* gap；
* width / height；
* 简单定位；
* 简单响应式；
* 简单字体尺寸；
* 简单颜色；
* 简单圆角；
* 简单边框。

### CSS Variables

用于定义全局 Design Tokens，例如：

```css
:root {
  --color-bg: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-text-muted: ...;
  --color-primary: ...;

  --font-body: ...;
  --font-heading: ...;

  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;

  --space-xs: ...;
  --space-sm: ...;
  --space-md: ...;
  --space-lg: ...;
  --space-xl: ...;
}
```

具体名称和数量根据实际设计决定，不要机械创建大量 Token。

### 原生 CSS

用于：

* 复杂视觉效果；
* 组件专属样式；
* 伪元素；
* 动画；
* 复杂选择器；
* 特殊布局；
* Tailwind 不适合表达的样式。

---

# 8. CSS 屎山治理

禁止通过不断添加 CSS 来解决问题。

遇到样式问题时，优先检查：

1. 是否存在重复规则；
2. 是否存在更高优先级规则；
3. 是否存在旧样式覆盖新样式；
4. 是否存在错误的组件边界；
5. 是否应该修改 Design Token；
6. 是否应该删除旧样式。

不要习惯性使用：

```css
!important
```

除非确实存在合理原因。

---

## 8.1 避免高特异性选择器

尽量避免：

```css
.page .content .card .title span {
}
```

优先：

```css
.card-title {
}
```

或者使用组件自身的样式作用域。

---

## 8.2 不要维护两套完全相同的样式

例如：

```html
<div class="mt-4 p-4 rounded-lg custom-card">
```

同时：

```css
.custom-card {
  margin-top: 16px;
  padding: 16px;
  border-radius: 8px;
}
```

如果 Tailwind 已经足够表达，就不要再次定义相同属性。

反过来，如果组件具有复杂视觉效果，则应该把复杂部分集中到组件 CSS 中，而不是堆积大量 Tailwind class。

---

# 9. Design Tokens

重构过程中逐步建立统一视觉变量。

至少考虑：

* 页面背景色；
* 表面 / 卡片背景色；
* 主文字；
* 次要文字；
* 边框；
* 强调色；
* 字体；
* 字号层级；
* 圆角；
* 阴影；
* 间距；
* 内容最大宽度。

原则：

> 经常一起修改的视觉属性，才值得成为 Token。

不要为了“看起来专业”创建几十上百个变量。

---

# 10. 页面与 Layout

Astro 项目应该合理区分：

* 页面；
* Layout；
* Components。

例如：

```text
src/
├── layouts/
│   ├── BaseLayout.astro
│   └── ArticleLayout.astro
│
├── pages/
│   ├── index.astro
│   ├── about.astro
│   └── posts/
│
└── components/
```

Layout 用于共享页面结构。

例如：

* `<html>`;
* `<head>`;
* Header；
* Footer；
* 全局 metadata；
* 页面容器。

不要把所有页面逻辑全部塞进一个巨大 Layout。

---

# 11. 视觉设计原则

这是个人网站，因此视觉设计应该具有明确的个人风格，而不是简单套一个 SaaS 模板。

目标：

* 简洁；
* 有设计感；
* 有个人特色；
* 信息层级清晰；
* 不过度堆叠卡片；
* 不使用无意义的渐变、玻璃拟态或动画；
* 动画应该服务于交互，而不是装饰。

如果已有视觉风格，则优先保留其中真正具有识别度的部分。

---

# 12. 页面重构策略

页面重构遵循：

> 先结构，再视觉，再细节。

不要一边大改布局、一边大改 CSS、一边修改数据逻辑、一边修改路由。

推荐流程：

### 第一步：保留功能

确保：

* 页面路由正常；
* 数据正常；
* 链接正常；
* Markdown 正常；
* 图片正常；
* 响应式基本正常。

### 第二步：确定页面结构

例如：

```text
Page
├── Header
├── Main
│   ├── Hero
│   ├── Content
│   └── ...
└── Footer
```

### 第三步：应用 Design Tokens

统一：

* 颜色；
* 字体；
* 间距；
* 圆角；
* 阴影；
* 内容宽度。

### 第四步：处理响应式

至少检查：

* 桌面端；
* 平板宽度；
* 手机宽度。

---

# 13. 响应式设计

不要只让页面“能缩小”。

需要考虑真正的布局变化。

检查：

* 横向溢出；
* 图片尺寸；
* 长标题；
* Markdown 表格；
* 代码块；
* 导航；
* 卡片；
* 文章正文宽度；
* 图片在手机上的显示；
* 点击区域。

---

# 14. Markdown / 文章系统

文章内容应该逐步从网站源码中分离。

目标结构：

```text
Website Repository
    Astro website source

Content Repository
    posts/
        article-1/
            index.md
            images/
                cover.webp
                image-01.webp

        article-2/
            index.md
            images/
                cover.webp
```

文章仓库可以是独立 Git repository。

网站仓库不应该保存全部原始文章。

---

# 15. Astro Content Collections

如果当前项目已经使用 Astro Content Collections / `src/content`：

不要为了分离仓库而强行废弃现有内容系统。

优先考虑：

> 私有文章仓库 → 构建阶段导入 → Astro Content Collections / Markdown → 静态生成

具体实现根据当前 Astro 版本决定。

如果当前项目没有使用 Content Collections，也不要为了“看起来正规”强制引入，除非它确实能明显简化文章管理。

---

# 16. 文章 Front Matter

推荐使用 Front Matter：

```yaml
---
title: "文章标题"
description: "文章简介"
date: "2026-01-01"
updated: "2026-01-02"
tags:
  - Astro
  - Frontend
published: true
cover: "./images/cover.webp"
---
```

字段应该根据实际网站需要决定。

不要为了“标准化”而添加大量没有实际用途的字段。

---

# 17. Draft / Published

文章是否进入网站应该由明确状态控制。

例如：

```yaml
published: false
```

表示草稿。

```yaml
published: true
```

表示发布。

构建流程只应该将：

```yaml
published: true
```

的文章纳入网站。

如果 Astro Content Collections 已经使用其他成熟的草稿机制，则优先使用现有机制，而不是重复建立系统。

---

# 18. 私有文章仓库安全原则

文章源仓库可以保持 Private。

注意：

**Private Git 仓库 ≠ 网站上的文章私有。**

只要文章被发布到网站：

* Markdown 渲染后的内容会公开；
* 公开文章图片会公开；
* 浏览器最终可以获取公开文章所需的数据。

因此：

> 私有仓库的作用是保护“源文件仓库”，而不是让已经发布的文章保持私密。

文章目录中不要放：

* 私人笔记；
* 未发布草稿；
* 私人图片；
* API Key；
* 密码；
* Token；
* 私人信息。

即使文章被标记为 `published: true`，也应该确保整个文章目录只包含可以公开的内容。

---

# 19. 图片管理

文章图片不要全部塞在一个全局图片目录。

优先使用：

```text
posts/
└── my-article/
    ├── index.md
    └── images/
        ├── cover.webp
        ├── image-01.webp
        └── image-02.webp
```

这样：

* 文章和图片天然绑定；
* Obsidian 更容易管理；
* 删除文章时不会留下大量孤立图片；
* 图片命名冲突更少；
* 网站构建时可以按文章处理资源。

---

## 19.1 不要为了分离仓库而盲目复制所有图片

构建时应该尽量只把实际需要公开的文章和资源复制到网站构建环境。

如果未来文章数量增长，再考虑：

* 图片压缩；
* WebP；
* AVIF；
* CDN；
* 独立图片仓库；
* 对象存储。

目前不要提前引入复杂方案。

---

# 20. 内容构建流程

最终目标类似：

```text
Private Content Repository
        │
        │ GitHub Actions
        ▼
Website Repository
        │
        │ import published content
        ▼
Astro Build
        │
        │ pnpm build
        ▼
dist/
        │
        ▼
Cloudflare Pages
```

网站仓库负责：

* Astro 页面；
* Astro Components；
* Layout；
* CSS；
* Tailwind；
* TypeScript；
* 构建逻辑。

文章仓库负责：

* Markdown；
* Front Matter；
* 文章图片；
* 文章相关公开资源。

---

# 21. 内容导入脚本

如果需要编写：

```text
scripts/import-content.mjs
```

应该遵循：

1. 只读取明确的文章目录；
2. 只处理 `published: true`；
3. 不复制未发布文章；
4. 不读取不必要的私人目录；
5. 对文件类型进行限制；
6. 尽量避免把整个私有仓库复制到网站；
7. 构建失败时应该明确报错。

不要简单地：

```bash
cp -r private-content public/
```

---

# 22. Markdown 安全

Markdown 如果支持 HTML，需要考虑 XSS。

不要因为这是个人网站就完全忽略：

* `<script>`;
* 内联事件；
* 恶意 HTML；
* 不安全链接；
* 不可信内容。

如果 Markdown 来源始终是自己控制的私有仓库，风险较低，但仍应避免建立明显的不安全处理方式。

---

# 23. 部署

网站最终部署到 **Cloudflare Pages**。

不需要同时维护 Vercel、GitHub Pages 等多套生产部署流程。

推荐构建流程：

```text
Private Content Repository
        │
        │ GitHub Actions
        ▼
Website Repository
        │
        │ import published content
        ▼
pnpm install --frozen-lockfile
        │
        ▼
pnpm build
        │
        ▼
dist/
        │
        ▼
Cloudflare Pages
```

Cloudflare Pages 只负责托管最终生成的静态网站。

不要让浏览器直接访问私有文章仓库。

---

# 24. Cloudflare 部署原则

推荐由 GitHub Actions 完成：

1. Checkout 私有文章仓库；
2. Checkout 公开网站仓库；
3. 安装 pnpm；
4. 安装依赖；
5. 导入 `published: true` 的文章；
6. 执行 `pnpm build`；
7. 将 `dist/` 部署到 Cloudflare Pages。

如果项目实际采用其他等价的 Cloudflare 部署方式，也可以使用，但必须保持：

> 私有文章仓库 → 构建 → 静态产物 → Cloudflare Pages

这一核心结构。

---

# 25. Secrets

Cloudflare 所需的：

* API Token；
* Account ID；
* 其他部署凭证；

必须存放在 GitHub Actions Secrets / Variables 中。

禁止：

* 写入源码；
* 写入 `AGENTS.md`；
* 写入 `.env` 后提交 Git；
* 写入前端代码；
* 写入构建产物。

---

# 26. 公开网站仓库

网站源码仓库可以保持 Public。

但公开仓库中禁止出现：

* 私有文章源码；
* 私人草稿；
* 私人图片；
* API Token；
* Cloudflare Token；
* GitHub Token；
* 密码；
* 其他敏感信息。

---

# 27. Agent 工作规则

AI Agent 在修改代码前必须：

1. 阅读相关文件；
2. 理解当前实现；
3. 判断修改影响范围；
4. 尽量做最小必要修改。

不要：

* 随意删除代码；
* 随意重命名大量文件；
* 随意更换依赖；
* 随意升级依赖；
* 随意修改 Astro 配置；
* 随意修改路由；
* 随意修改内容结构；
* 为了“看起来更干净”而重写稳定代码。

---

# 28. 修改前的检查

进行较大修改前，应至少确认：

```bash
pnpm install
pnpm build
```

如果项目存在 lint / typecheck / test，则根据实际项目执行。

例如：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

不要假设项目一定存在这些命令。

先检查 `package.json`。

---

# 29. 每次重要修改后的检查

完成一个阶段后至少：

```bash
pnpm build
```

如果修改了：

* Astro 页面 → 检查对应页面；
* Layout → 检查所有使用该 Layout 的页面；
* CSS → 检查主要页面 + 手机端；
* Markdown → 检查文章列表、文章详情、图片；
* Content Collections → 检查内容查询和构建；
* 构建脚本 → 检查干净环境下的构建；
* 部署配置 → 检查生产构建。

---

# 30. 视觉检查

对于视觉重构，不要只依赖代码检查。

如果环境支持截图或浏览器预览：

1. 启动开发服务器；
2. 查看页面；
3. 检查桌面端；
4. 检查移动端；
5. 检查主要交互；
6. 检查控制台错误；
7. 检查是否出现横向滚动；
8. 检查字体、颜色、间距是否统一。

---

# 31. CSS 审计阶段

在真正修改 CSS 前，先进行一次只读审计。

重点寻找：

* 重复 CSS；
* 重复 Tailwind class；
* 无效 CSS；
* 已经不存在的 class；
* `!important`；
* 高特异性选择器；
* 全局样式污染；
* Astro Component 样式之间的冲突；
* Tailwind 与 CSS 重复定义；
* 响应式覆盖；
* 同一个变量多处定义；
* 组件之间互相覆盖。

第一阶段只输出：

```text
问题
位置
影响
建议
```

不要立即大规模修改。

---

# 32. 清理旧代码

只有在确认：

* 没有引用；
* 不再需要；
* 不影响构建；
* 不影响运行时；

之后，才删除旧代码。

如果不确定某段代码是否仍在使用：

**不要直接删除。**

先搜索引用。

---

# 33. 依赖管理

不要为了重构随意增加 pnpm 依赖。

新增依赖前需要考虑：

1. 是否真的需要；
2. 原有依赖能否完成；
3. 是否可以用 Astro 原生能力；
4. 是否可以用原生 Web API；
5. 是否会增加维护成本；
6. 是否影响构建体积。

如果只是为了完成一个非常简单的功能，优先使用现有能力。

---

# 34. 兼容性原则

默认目标：

* 当前主流 Chromium；
* Firefox；
* Safari；
* 手机浏览器。

不要为了极端浏览器兼容引入大量复杂代码。

---

# 35. 性能原则

Astro 本身适合生成轻量静态网站。

优先处理真正有意义的问题：

* 巨大的图片；
* 不必要的 TypeScript；
* 不必要的客户端 hydration；
* 重复请求；
* 大型依赖；
* 明显的布局抖动；
* 首屏资源过大。

不要为了几十 KB 的理论收益，把项目搞得非常复杂。

---

# 36. SEO / 可访问性

在视觉重构时不要破坏：

* `<title>`;
* meta description；
* heading 层级；
* 图片 `alt`;
* 链接语义；
* button / link 的正确使用；
* 键盘操作；
* 基本颜色对比度；
* canonical 等已有 SEO 配置。

如果已有 SEO 逻辑，不要无理由删除。

---

# 37. 最终目标架构

最终不要求严格长成某种固定目录。

但整体职责应该接近：

```text
Website Repository
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── ArticleLayout.astro
│   │
│   ├── pages/
│   │   ├── index.astro
│   │   └── ...
│   │
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── base.css
│   │   └── ...
│   │
│   └── ...
│
├── public/
│
├── scripts/
│   └── import-content.mjs
│
├── package.json
├── pnpm-lock.yaml
├── astro.config.*
├── tailwind.config.*
└── AGENTS.md
```

私有文章仓库：

```text
Content Repository
│
├── posts/
│   ├── article-1/
│   │   ├── index.md
│   │   └── images/
│   │
│   └── article-2/
│       ├── index.md
│       └── images/
│
├── drafts/
│
└── ...
```

具体目录以实际项目需求为准。

---

# 38. 推荐重构顺序

Agent 不应该直接执行完整重构。

按照以下顺序进行：

## Phase 0 — Baseline

确认：

* 项目可以运行；
* `pnpm build` 成功；
* 当前 Git 状态干净；
* 记录当前项目结构；
* 记录主要页面；
* 必要时保存当前页面截图。

---

## Phase 1 — Audit

只读分析：

* Astro 项目结构；
* CSS；
* Tailwind；
* Components；
* Layouts；
* Pages；
* Markdown / MDX；
* Content Collections；
* 静态资源；
* 构建流程；
* Cloudflare 部署相关配置。

此阶段不要大改。

---

## Phase 2 — CSS Architecture

解决：

* CSS 重复；
* 样式覆盖；
* Design Tokens；
* Tailwind / CSS 职责；
* 全局样式；
* Component 样式边界。

---

## Phase 3 — Shared Components

整理：

* Header；
* Footer；
* Navigation；
* Button；
* Card；
* Tag；
* Typography；
* 其他真正具有复用价值的组件。

---

## Phase 4 — Page Redesign

建议：

```text
首页
↓
文章列表
↓
文章详情
↓
其他页面
```

一次重构一个页面。

---

## Phase 5 — Content Separation

实现：

```text
Private Markdown Repository
        ↓
Content Import
        ↓
Astro Content / Markdown
        ↓
Astro Build
        ↓
dist
        ↓
Cloudflare Pages
```

确保：

* 草稿不会发布；
* 图片正常；
* Front Matter 正常；
* 文章列表正常；
* 文章详情正常。

---

## Phase 6 — Regression

检查：

* 所有路由；
* 所有页面；
* Markdown；
* 图片；
* 移动端；
* 桌面端；
* build；
* 控制台；
* 404；
* 外部链接。

---

## Phase 7 — Cleanup

最后再：

* 删除旧 CSS；
* 删除废弃组件；
* 删除无用依赖；
* 删除旧资源；
* 整理目录；
* 更新文档。

不要在前几个阶段就急着删除所有旧代码。

---

# 39. Agent 输出要求

当完成一个阶段时，不需要输出大量解释。

请简洁说明：

```text
完成：
- xxx
- xxx
- xxx

检查：
- pnpm build：通过
- lint：通过 / 未配置
- 其他检查：xxx

发现的问题：
- xxx

下一步建议：
- xxx
```

如果发现需要用户做决定的问题，暂停修改并明确提出。

---

# 40. 遇到不确定问题时

如果有多个合理方案：

不要直接选择一个大幅改变项目结构的方案。

应该：

1. 说明问题；
2. 列出 2～3 个方案；
3. 说明各自优缺点；
4. 推荐一个；
5. 等待确认。

尤其是以下情况：

* 更换技术栈；
* 更换 CSS 方案；
* 更换 Markdown 系统；
* 更换 Astro 内容方案；
* 大规模移动文件；
* 删除大量代码；
* 引入新的大型依赖；
* 改变文章数据结构；
* 改变部署方式。

---

# 41. 最重要的原则

本项目的重构目标不是：

> 让代码看起来像一个“专业大型项目”。

而是：

> 让这个个人网站以后可以轻松修改、写文章、换样式、增加页面，而不需要每次都和历史 CSS 斗争。

因此优先级为：

```text
可维护性
>
清晰度
>
稳定性
>
视觉一致性
>
性能优化
>
工程化程度
```

如果某个“更工程化”的方案会让个人网站变得更复杂，则优先选择更简单的方案。
