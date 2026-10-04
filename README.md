# Summer Annual（V2）

个人网站：Astro 5 + Tailwind CSS 4 + TypeScript，部署到 Cloudflare Pages。
文章源文件放在私有仓库 [Summer-Annual-Blog-Article]，构建时自动导入。

> TODO: 加个网站留言板功能,放在About上面，侧边的小组件栏放置标签栏、文件夹(分类)栏，把主背景改成嵌入不随滚动移动的纯背景效果

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
`draft: true` 不会发布。完整格式见文章仓库的 README。

## 部署（.github/workflows/deploy.yml）

```text
文章仓库 push ──┐
网站仓库 push ──┼→ GitHub Actions：检出两仓库 → 导入已发布文章 → pnpm build
手动触发 ──────┘        → wrangler pages deploy dist → Cloudflare Pages
```

网站仓库需要配置的 Secrets（Settings → Secrets and variables → Actions）：

| Secret | 说明 |
| --- | --- |
| `ARTICLE_REPO_TOKEN` | GitHub PAT，至少可读文章仓库 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（Pages Edit 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

文章仓库如需「推送即更新网站」，在其 `.github/workflows/` 加：

```yaml
name: Notify website rebuild
on: push
jobs:
    dispatch:
        runs-on: ubuntu-latest
        steps:
            - run: |
                curl -X POST \
                  -H "Authorization: Bearer ${{ secrets.SITE_REPO_TOKEN }}" \
                  -H "Accept: application/vnd.github+json" \
                  https://api.github.com/repos/YuunagiHirozuki/Summer-Annual-V2/dispatches \
                  -d '{"event_type":"content-update"}'
```

（`SITE_REPO_TOKEN` 存在文章仓库的 Secrets 里，是对网站仓库有 Actions 写权限的 PAT。）
不配置也不影响：网站仓库支持手动 workflow_dispatch，且网站推送总会触发构建。

[Summer-Annual-Blog-Article]: https://github.com/YuunagiHirozuki/-Summer-Annual-Blog-Article
