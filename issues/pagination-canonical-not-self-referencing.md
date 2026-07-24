# 分页 canonical 未自引用

严重级别：警告

根据 `docs/02-url-architecture.md` 的分页 canonical 规则，第 N 页应 canonical 到自身。审阅 `/movies?page=2` 时，页面显示第二页不同内容，但 canonical 仍为 `https://f-movies.app/movies`。这会让搜索引擎把后续分页内容误判为第一页重复内容。

## 受影响页面

- `/movies?page=2`（同类所有 `/movies?page=N`）
- `/tv-series?page=N`
- `/top-imdb?page=N`
- `/genre/:id?page=N`
- `/country/:slug?page=N`

## 修复建议

让 BaseLayout 接收页面的规范路径或查询参数。第 1 页 canonical 到无参数主列表页；从第 2 页开始 canonical 使用自身的 `?page=N`。可额外在 head 中输出合适的 `rel="prev"` 和 `rel="next"` 链接，且无效页码必须返回 404。
