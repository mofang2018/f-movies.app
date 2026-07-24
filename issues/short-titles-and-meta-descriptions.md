# Title 与 meta description 长度偏短

严重级别：警告

根据 `docs/01-meta-foundations.md`，title 建议为 50–60 字符，description 建议为 150–160 字符。审阅的目录页 title 大多只有约 20–35 字符，description 约 35–100 字符；虽内容相关且无占位符，但在搜索结果中缺少更完整的主题、差异化与点击动机。

## 受影响页面

- `/`
- `/home`
- `/movies`（及分页）
- `/tv-series`（及分页）
- `/top-imdb`（及分页）
- `/genre/28`（同类所有 `/genre/:id`）
- `/country/united-states`（同类所有 `/country/:slug`）
- `/search`
- `/search?q=animation`（同类所有搜索结果页）

## 修复建议

为模板化页面增加独有信息但避免关键词堆砌。示例：类型页可加入“Action Movies to Discover — Ratings, Cast & More | F.MOVIES”；description 说明可浏览的内容、TMDB 信息和明确的下一步。详情页 description 应从完整概述安全截取到约 150–160 字符，避免每页使用同一通用文案。
