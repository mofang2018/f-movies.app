# 缺少 robots meta 指令

严重级别：错误

根据 `docs/01-meta-foundations.md` 的「索引控制」规则，每个页面应根据性质提供 `<meta name="robots">`。当前审阅的可索引页面均未输出显式 `index,follow`，搜索页也没有 `noindex,follow`。这让索引策略完全依赖默认行为，无法清晰表达目录页、搜索页和错误页的不同意图。

## 受影响页面

- `/`
- `/home`
- `/movies`
- `/tv-series`
- `/top-imdb`
- `/genre/28`（同类所有 `/genre/:id`）
- `/country/united-states`（同类所有 `/country/:slug`）
- `/movie/the-shawshank-redemption-278`（同类所有有效详情页）
- `/tv/:slug`（同类所有有效详情页）
- `/search`
- `/search?q=animation`（同类所有搜索结果页）

## 修复建议

在 BaseLayout 增加可配置的 robots prop：正常目录与详情页默认输出 `index,follow`；`/search` 及其分页输出 `noindex,follow`。不要把 noindex 页面放入 sitemap。错误页面应在专用 404 页面中输出 `noindex,follow`，并确保没有冲突的 `X-Robots-Tag`。
