# Twitter Card 元数据不完整

严重级别：警告

根据 `docs/04-social-and-structured-data.md` 的 Twitter/X Cards 规则，除 `twitter:card` 外还应提供 `twitter:title`、`twitter:description` 与绝对 URL 的 `twitter:image`。当前所有审阅页面仅提供 `twitter:card=summary_large_image`；详情页虽有 og:image，仍缺少 Twitter 对应字段。

## 受影响页面

- `/`
- `/home`
- `/movies`
- `/tv-series`
- `/top-imdb`
- `/genre/28`（同类所有 `/genre/:id`）
- `/country/united-states`（同类所有 `/country/:slug`）
- `/search`
- `/movie/the-shawshank-redemption-278`（同类所有有效详情页）
- `/tv/:slug`（同类所有有效详情页）

## 修复建议

在 BaseLayout 中从每页的 title、description、image 派生 `twitter:title`、`twitter:description`、`twitter:image`；对没有专属图片的页面使用同一张默认分享图。不要只依赖平台对 Open Graph 的回退行为。
