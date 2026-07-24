# 缺少 Open Graph 分享图片

严重级别：错误

根据 `docs/04-social-and-structured-data.md` 的 og:image 规则，所有页面必须有绝对 HTTPS 的 `og:image`。当前只有带 backdrop 的媒体详情页输出该标签；首页、列表、分类、国家与搜索页没有分享图片，因此社交平台的预览不稳定或无图。

## 受影响页面

- `/`
- `/home`
- `/movies`（及分页）
- `/tv-series`（及分页）
- `/top-imdb`（及分页）
- `/genre/28`（同类所有 `/genre/:id` 及分页）
- `/country/united-states`（同类所有 `/country/:slug` 及分页）
- `/search`
- `/search?q=animation`（同类所有搜索结果页）

## 修复建议

在 R2 中制作一张 1200×630 的站点默认分享图，并让 BaseLayout 在没有页面专属图片时输出它。列表、分类、国家页可选用对应首张海报/背景图，但必须保证图片稳定、可公开访问且为绝对 HTTPS URL。同步添加 `og:image:width`、`og:image:height`、`twitter:image`。
