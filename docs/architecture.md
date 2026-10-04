# 网站架构

```mermaid
flowchart LR
    OBS["Obsidian<br/>本地写作 + 粘贴图片"] -->|"git push / 网页拖拽"| REPO["文章仓库（私有）<br/>-Summer-Annual-Blog-Article<br/>posts/&lt;slug&gt;/index.md"]
    YOU["你"] -->|"面板拖拽上传"| R2["Cloudflare R2<br/>bucket: gallery/*.png|jpg"]

    subgraph actions["GitHub Actions（网站仓库 Summer-Annual-V2）"]
        IMP["1. import-content.mjs<br/>只导入 draft:false 的文章"]
        BUILD["2. astro build<br/>内容集合 + 双主题 token<br/>S3 列出画廊清单 · sharp 压缩封面"]
        DEP["3. wrangler pages deploy"]
        IMP --> BUILD --> DEP
    end

    TRIG["触发器<br/>网站 push / 文章仓库 push<br/>手动 Run"] --> actions

    REPO -->|"Actions 里 checkout"| IMP
    R2 -.->|"构建时列出图片清单"| BUILD

    DEP --> SITE["Cloudflare Pages<br/>summer-annual.pages.dev"]
    R2 -->|"pub-xxx.r2.dev 图片直出"| SITE

    VIS["访客浏览器"] -->|"页面"| SITE
    VIS -->|"画廊/封面图片"| R2
```

## 图例说明

- **文章仓库（私有）**：只存文章源文件（md + 图片引用），不含任何站点代码
- **网站仓库（公开）**：Astro 源码 + 构建流水线；构建产物（含文章内容）只存在 dist/，不进仓库
- **R2（图床）**：画廊图片直出，读操作公开、写操作仅凭据
- **触发器**：三条路都会触发完整构建——网站 push、文章仓库 push（notify-site.yml 发 repository_dispatch）、Actions 手动
- **本地开发**：`pnpm dev` 读取 `.env` 里的 R2 凭据，与线上同一套构建逻辑，`localhost:4321` 全功能预览
