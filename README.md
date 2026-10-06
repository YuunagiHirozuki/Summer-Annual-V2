# Summer Annual（V2）

个人网站：Astro 5 + Tailwind CSS 4 + TypeScript，部署到 Cloudflare Pages。
文章源文件放在私有仓库 [Summer-Annual-Blog-Article]，构建时自动导入。

> TODO: 修改文章列表的时间日期格式、加个网站留言板功能,放在About上面，侧边的小组件栏放置文件夹(分类)栏，把主背景改成嵌入不随滚动移动的纯背景效果

## 命令

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 本地开发，localhost:4321 |
| `pnpm build` | 生产构建到 `dist/` |
| `pnpm preview` | 本地预览构建产物 |
| `node scripts/import-content.mjs <文章仓库路径>` | 手动导入文章（CI 自动执行） |

## 结构

```text
src/
├── components/          # Header(含移动端抽屉/主题切换) PostCard TOC ...
├── layouts/
│   ├── BaseLayout.astro # 唯一拥有 <html> 的层：head/导航/关于/联系/页脚
│   └── ArticleLayout.astro
├── pages/               # index posts/ archive gallery projects rss.xml.ts
├── styles/
│   ├── tokens.css       # 设计 token：黑夜(默认)与白天两套水色主题
│   ├── base.css         # 字体/元素默认/动画
│   └── prose.css        # Markdown 正文样式
├── utils/posts.ts       # 排序/草稿过滤/上下篇/封面地址
└── content.config.ts    # 内容集合定义
scripts/
└── import-content.mjs   # 从文章仓库导入已发布文章
```

- 主题切换：黑夜为默认，白天由 `html[data-theme='light']` 切换，选择存 localStorage
- 颜色只在 `tokens.css` 定义，Tailwind 通过 `@theme inline` 引用（`bg-background` / `text-ink` / `text-aqua` …）

## 写文章

在私有文章仓库 `posts/<slug>/` 下写 `index.md`，图片放同目录 `images/`，
`draft: true` 不会发布。仓库根目录的 `_template.md` 是 front matter 模板。
完整格式见文章仓库的 README。

## 画廊（图片存 Cloudflare R2）

1. Cloudflare 建一个 R2 bucket，在 bucket 设置里开启公开访问（r2.dev 域名）
2. R2 → Manage R2 API Tokens → 创建一个 **Object Read** 权限的 API Token，
   把 Access Key ID / Secret Access Key 配到网站仓库 Secrets
3. 把图片上传到 bucket 的 `gallery/` 目录（png/jpg/webp/gif/avif，
   文件名排序即展示顺序，建议 `01-xxx.png` 编号命名）
4. 触发一次构建：网站仓库 Actions 手动 Run

画廊页在构建时通过 S3 接口列出 bucket 的 `gallery/` 对象，
所以图片上传本身不需要动任何仓库。

## 部署（.github/workflows/deploy.yml）

```text
文章仓库 push ──┐
网站仓库 push ──┘→ GitHub Actions：检出两仓库 → 导入已发布文章 → pnpm build
                        → wrangler pages deploy dist → Cloudflare Pages
```

网站仓库需要配置的 Secrets（Settings → Secrets and variables → Actions）：

| Secret | 说明 |
| --- | --- |
| `ARTICLE_REPO_TOKEN` | GitHub PAT，至少可读文章仓库 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（Pages Edit 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 API Token 的 Access Key ID（Object Read，画廊列表用） |
| `R2_SECRET_ACCESS_KEY` | 上一个 token 的 Secret Access Key |

Variables 标签页（非加密变量，画廊构建时读取）：

| Variable | 说明 |
| --- | --- |
| `R2_BUCKET` | 画廊图片所在的 R2 bucket 名 |
| `R2_PUBLIC_BASE` | bucket 公开访问域名，如 `https://pub-xxxxxxxx.r2.dev` |

本地开发时把同样的值填进 `.env`（模板见 `.env.example`）。

文章仓库已配置「push 即更新网站」：其 `.github/workflows/notify-site.yml`
会向本仓库发 `repository_dispatch`（event_type: `content-update`）。
它需要把一个 PAT 存到**文章仓库**的 Secrets：`SITE_REPO_TOKEN` ——
对 Summer-Annual-V2 有 **Contents: Read and write** 权限的 fine-grained
token（`repository_dispatch` 要求 contents:write）。未配置前该 workflow
会失败，不影响网站正常构建。

[Summer-Annual-Blog-Article]: https://github.com/YuunagiHirozuki/-Summer-Annual-Blog-Article
