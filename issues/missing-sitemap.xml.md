# 缺少 sitemap.xml

严重级别：错误

根据 `docs/06-crawlability-and-index-control.md` 的 Sitemap.xml 存在性、XML 格式与绝对 URL 规则，站点必须提供可访问的 sitemap 或 sitemap index。当前 `robots.txt` 声明了 `https://f-movies.app/sitemap-index.xml`，但项目没有生成 sitemap 的集成、路由或构建产物；该声明会把搜索引擎引向不存在的资源。

## 受影响页面

- `/robots.txt`
- `/sitemap-index.xml`
- 全站所有应收录页面

## 修复建议

使用 Astro sitemap 集成或 Worker 动态 sitemap 路由生成 `sitemap-index.xml` 和分片 sitemap。写入绝对的 `https://f-movies.app/...` URL，只包含可索引、返回 200 的页面：`/`、`/home`、目录页、有效分类/国家页和有效详情页；排除搜索结果、404 与无数据页面。随后保留 robots.txt 中同一绝对 URL 的 Sitemap 声明，并在部署后验证 XML 声明、命名空间、无重复 URL 与一致的无尾斜杠格式。
