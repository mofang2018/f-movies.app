# 404 页面缺少 SEO 元数据与 noindex

严重级别：警告

根据 `docs/02-url-architecture.md` 与 `docs/07-integrity-security-and-performance.md`，404 必须返回 404，并应带合适的 title、description 和 noindex。当前无效 URL 能显示 Astro 的默认 `404: Not Found` 并返回错误状态，但页面没有 description、canonical、robots 或站点导航，且 title 为通用默认值。

## 受影响页面

- `/movie/278`
- `/movie/not-a-real-movie-278`
- `/not-a-real-page`
- 同类所有不存在的路由、错误 slug 与无效详情页

## 修复建议

添加 `src/pages/404.astro`，通过 BaseLayout 输出清晰的 “Page not found | F.MOVIES” title、简短 description、`<meta name="robots" content="noindex,follow">`，以及返回首页、Movies 和搜索的链接。保持 HTTP 404，不要将不存在页面改为 200 或跳转到首页。
