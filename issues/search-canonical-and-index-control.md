# 搜索页 canonical 与索引控制不当

严重级别：警告

根据 `docs/02-url-architecture.md` 的 canonical 自引用规则，以及 `docs/06-crawlability-and-index-control.md` 的搜索结果 noindex 规则，带查询词的搜索结果既不应作为高质量可索引页面，也不应以空搜索页作为 canonical。当前 `/search?q=animation` 的可见内容和 title 是 animation 的结果，但 canonical 为 `https://f-movies.app/search`；同时没有 noindex 指令。

## 受影响页面

- `/search?q=animation`
- `/search?q=documentary`
- 同类所有 `/search?q=:query` 与其分页

## 修复建议

搜索结果输出 `<meta name="robots" content="noindex,follow">`。空搜索入口 `/search` 可以保持可索引或 noindex，但要明确选择；对于带查询词的页面，不要 canonical 到空搜索页。通常可让 canonical 自引用其规范化查询参数，或在 noindex 策略下移除 canonical，前提是全站策略一致。
