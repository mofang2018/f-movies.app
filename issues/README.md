# F.MOVIES 页面 SEO 审计

审计时间：2026-07-24  
审计入口：`https://f-movies-app.ericfang2013.workers.dev/`  
首选域名：`https://f-movies.app`

本报告按 [onpage-seo-audit](https://github.com/linhan-dev/onpage-seo-audit) 的规则完成。审阅了落地页、内容首页、电影/剧集/榜单页、类型页、国家页、搜索页、详情页、分页与无效 URL；同时检查了 `robots.txt` 源文件与构建产物。

## 汇总

- 错误：4 类
- 警告：6 类
- 提示：2 类（未单独建问题文件）

## 修复优先级

1. 提供真正的 sitemap，并修复 robots 中指向的失效 sitemap URL。
2. 为每一个可索引页面输出 `index,follow`，为搜索页和 404 输出 `noindex,follow`。
3. 修复 `/home` 的多个 H1，并为所有页面补齐 Open Graph / Twitter 分享图片。
4. 将分页 canonical 改为自引用；将搜索结果页设为 noindex 且不把带查询词的结果 canonical 到空搜索页。
5. 扩充标题、description、结构化数据和导航增强信号。

## 已验证的基础项

- 线上公开页面使用 HTTPS，且 canonical 是绝对 HTTPS URL。
- 公开页面有 `<!doctype html>`、`lang="en"`、UTF-8、viewport、title、description、canonical、语义化 `header`/`main`/`nav`/`footer`。
- 电影详情页有自引用 canonical、Movie JSON-LD、描述性海报 alt 和尺寸属性。
- 媒体卡片图片有 alt、宽高、首屏外懒加载；主要列表页有可抓取分页链接。
- 首页的 SearchAction JSON-LD 语法有效且值与页面相符。

## 低优先级提示

- 建议为首页与详情/层级页补充 `BreadcrumbList`，并增加可见的面包屑。
- 建议增加 `apple-touch-icon`、Web App Manifest、`og:site_name`、`og:locale`、`twitter:site`，以及明确的 CSP。
