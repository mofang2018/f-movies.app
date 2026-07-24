# 内容首页存在多个 H1

严重级别：错误

根据 `docs/05-semantic-html-and-content-structure.md` 的 H1 唯一与组件约束规则，每页必须有且仅有一个可见 H1，且可复用卡片或轮播组件不得使用 H1。`/home` 的 Hero 轮播把多部影片标题渲染为 H1，例如 The Odyssey、Tagesschau、Disclosure Day、Moana 和 Rote Rosen。

## 受影响页面

- `/home`

## 修复建议

将 Hero 内的每个影片标题降为 H2 或 p；在 `/home` 页面内容开头增加一个唯一、描述页面主题的 H1，例如 “Discover movies and TV series”。确保轮播切换不会额外插入新的 H1。
