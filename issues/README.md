# F.MOVIES 页面 SEO 审计

审计时间：2026-07-24

审计入口：`https://watchfmovies.org/`

首选域名：`https://watchfmovies.org`

本报告按 [onpage-seo-audit](https://github.com/linhan-dev/onpage-seo-audit) 的规则完成。审阅了落地页、内容首页、电影/剧集/榜单页、类型页、国家页、搜索页、详情页、分页与无效 URL；同时验证了生产域名的 `robots.txt`、sitemap、HTTPS 和规范域重定向。

## 汇总

- 待处理：0 类
- 已修复：7 类

## 修复优先级

1. 上线后持续监控搜索引擎抓取、Cloudflare Workers 错误率和 Core Web Vitals。

## 已验证的基础项

- 本地 SSR 页面有 `<!doctype html>`、`lang="en"`、UTF-8、viewport、favicon、Apple Touch Icon、manifest、theme color、唯一 title、description、canonical 和显式 robots 指令。
- 本地路由验证：无效 URL 返回 `404` 并带 `noindex,follow`；第一页重复分页 URL 返回 `301`；搜索页为 `noindex,follow` 且 canonical 自引用；空分页返回 `404`。
- `robots.txt` 允许公开抓取并声明绝对 sitemap URL；sitemap 为有效 XML、使用绝对 HTTPS URL，且不含搜索页或 404。
- 详情页有自引用 canonical、Movie/TVSeries 与 BreadcrumbList JSON-LD、描述性海报 alt、图片尺寸和懒加载。
- 媒体卡片图片有 alt、宽高、首屏外懒加载；主导航、页脚和分页均为可抓取的语义化链接。
- 默认 Open Graph/Twitter 分享图已替换为 1200×630 PNG；详情页使用媒体类型 Open Graph 标签。
- 空国家页现在输出 `noindex,follow`；类型、国家和详情页均有可见面包屑及一致的 JSON-LD。
- 全站 HTML 响应设置 CSP；搜索、DMCA 和 404 的标题及描述已扩展。
- `watchfmovies.org` 通过 Cloudflare DNS、有效 TLS 和 Worker 路由返回 `200`；`www.watchfmovies.org` 以 `301` 重定向至裸域，生产 `robots.txt` 与 sitemap 均可访问。
- 已放弃的 `f-movies.app` 不应重定向到新域，以免将历史垃圾外链信号传递给 `watchfmovies.org`；旧域应稳定返回 `410 Gone` 并携带 `X-Robots-Tag: noindex, nofollow`。

## 低优先级提示

- 建议增加 `twitter:site`，并在正式域名上线后使用搜索引擎和社交平台调试工具复查实际抓取结果。
