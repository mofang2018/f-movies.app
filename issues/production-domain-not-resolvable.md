# 生产域名尚未可解析

严重级别：错误

规则：`docs/02-url-architecture.md`（公开 URL 必须使用 HTTPS）与 `docs/06-crawlability-and-index-control.md`（robots.txt、sitemap.xml 必须可访问）。

在 2026-07-24 审计时，`https://f-movies.app/`、`https://f-movies.app/robots.txt`、`https://f-movies.app/sitemap.xml` 和 `https://www.f-movies.app/` 均返回 DNS 解析失败。搜索引擎与用户目前无法访问任何正式 URL，因此无法在生产环境验证 HTTPS、响应头、重定向、图片域名或抓取文件。

## 受影响页面

- `https://f-movies.app/`
- `https://f-movies.app/robots.txt`
- `https://f-movies.app/sitemap.xml`
- `https://www.f-movies.app/`

## 修复建议

在正式上线部署时，为 `f-movies.app` 配置指向 Cloudflare Worker 的路由/DNS 记录；若要支持 `www`，配置其永久重定向到首选裸域。上线后重新抓取全部 URL，确认 `robots.txt` 与 sitemap 返回 `200`、首选 URL 使用 HTTPS，且没有循环或跨域重定向。
