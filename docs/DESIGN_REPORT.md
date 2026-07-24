# f-movies.app 网站设计报告

## 1. 项目目标

`f-movies.app` 是一个基于 TMDB 数据的电影与剧集发现站。第一阶段提供首页推荐、分类浏览、关键词搜索和详情页，不提供真实视频播放、用户账户或收藏同步。

视觉与信息架构参考 `ffmovies.tv`（`www.f-movies.org` 当前重定向到该站），但使用独立的 `F•MOVIES` 品牌、原创文案与组件实现。项目采用 `JCodesMore/ai-website-cloner-template` 的调研、规格、组件拆分和视觉验收流程，不照搬其 Next.js 运行时。

## 2. 调研结论

参考站由两个入口组成：

- `/`：以大幅搜索框为核心的引导页，包含品牌标语、分享按钮、长篇 SEO 文案与页脚。
- `/home`：实际内容首页，包含顶部导航、电影背景 Hero、分享条、Trending Movies、Latest Movies、Popular TV Series 和多栏页脚。

核心视觉特征：

- 深炭黑背景：`#1e2129`；更深的页脚与面板：`#13151a`。
- 荧光黄绿色强调色，用于品牌符号、标题装饰、主要按钮和悬停状态。
- 系统无衬线字体，标题紧凑，正文使用灰白色层级。
- 海报卡片为高密度响应式网格；图片上叠加清晰度、评分和媒体类型标签。
- Hero 使用真实电影背景图、暗色遮罩和底部渐隐，不使用装饰性卡片。
- 桌面端显示完整导航和搜索框；移动端折叠菜单，卡片保持稳定的 `2:3` 比例。

## 3. 技术方案

### 3.1 技术栈

- Astro + TypeScript strict：默认零客户端 JavaScript，按需启用小型交互脚本。
- `@astrojs/cloudflare`：部署至 Cloudflare Workers，TMDB 请求在边缘执行。
- 原生 CSS：减少 UI 运行时与依赖，使用全局设计令牌和组件作用域样式。
- Lucide：按钮和导航图标使用一致的图标库，构建时打包为 SVG。
- TMDB API v3：服务端 Bearer Token；不向浏览器暴露 Token。

### 3.2 为什么选择 Astro

- 此站点以内容展示为主，绝大部分页面无需 React hydration。
- Cloudflare Worker 可在离用户近的边缘节点获取并缓存 TMDB 数据。
- 单一部署同时覆盖 SSR、搜索、详情路由和静态资源。
- HTML 输出直接、依赖少，冷启动和内存占用低。

### 3.3 数据流

```text
浏览器 -> Cloudflare Worker (Astro)
                  |-> Cache API / Astro fetch cache
                  |-> TMDB API
                  \-> Cloudflare 图片域名 -> TMDB 原图（缓存/转换）
```

`TMDB_READ_ACCESS_TOKEN` 只存在于本地 shell 或 Cloudflare Secret。应用在缺少 Token 或 TMDB API 暂时失败时使用由 `npm run data:refresh` 从 TMDB 官方网站生成的本地元数据快照，保证页面仍可构建和预览。快照仅保存文本字段和图片路径，不保存图片二进制文件。

## 4. Cloudflare 图片方案

所有组件只通过 `getImageUrl()` 生成图片地址：

- 生产环境设置 `PUBLIC_IMAGE_CDN_URL=https://images.f-movies.app`。
- 图片 Worker 接收 `/w500/<tmdb-path>`、`/w1280/<tmdb-path>` 等路径。
- Worker 从 `image.tmdb.org/t/p/original` 获取源图，使用 Cloudflare Image Resizing 转换为 AVIF/WebP，并设置长期缓存。
- 未配置 Cloudflare 图片域名的本地环境回退到 TMDB 官方图片 CDN，便于零配置开发。

这一抽象允许后续切换到 R2 持久缓存，而不改页面组件。

## 5. 页面与路由

| 路由 | 功能 | 渲染策略 |
| --- | --- | --- |
| `/` | 内容首页、Hero、趋势/热门/剧集 | SSR + 边缘缓存 |
| `/movies` | 热门电影列表 | SSR + 分页 |
| `/tv-series` | 热门剧集列表 | SSR + 分页 |
| `/genre/[id]` | 类型筛选 | SSR + 分页 |
| `/search?q=` | 电影与剧集搜索 | SSR，短缓存 |
| `/movie/[id]` | 电影详情 | SSR + 边缘缓存 |
| `/tv/[id]` | 剧集详情 | SSR + 边缘缓存 |

## 6. 组件体系

- `SiteHeader`：品牌、导航、桌面搜索、移动菜单。
- `Hero`：背景、媒体标签、简介、评分与详情按钮。
- `MediaSection`：带标题和“查看全部”的内容分区。
- `MediaCard`：海报、评分、年份、类型；悬停显示详情入口。
- `MediaGrid`：列表页的稳定响应式网格。
- `ShareStrip`：保留参考站的横向节奏，改为简洁分享入口。
- `SiteFooter`：品牌说明、电影、分类、支持四列链接。
- `DetailsHero`：详情页背景、海报和元数据。
- `NoPlaybackPanel`：明确站点当前只提供信息，不伪装真实播放器。

## 7. 响应式规则

- `>= 1180px`：最大内容宽度 `1240px`，海报 6 列，完整导航。
- `768-1179px`：海报 4 列，Hero 内容宽度收窄。
- `< 768px`：折叠菜单，Hero 高度约 `560px`，海报 2 列。
- 所有海报固定 `aspect-ratio: 2 / 3`，避免图片加载造成布局跳动。
- 所有图标按钮固定尺寸；长标题最多两行，避免越界。

## 8. 性能与缓存

- TMDB 首页聚合请求并行执行；单个失败不阻断整页。
- Worker 对首页与详情页响应设置 `s-maxage` 和 `stale-while-revalidate`。
- 海报使用响应式尺寸、懒加载和 Cloudflare 格式转换。
- 无状态、无数据库；第一阶段服务器成本主要是 Worker 请求与图片转换。
- 客户端仅包含移动菜单、Hero 切换和播放提示弹窗所需脚本。

## 9. 安全与合规

- Token 不进入 `PUBLIC_*` 环境变量、不写入仓库、不返回客户端。
- 页面底部展示 TMDB 数据来源声明与 TMDB 非背书声明。
- 不抓取或托管第三方视频，不实现播放源聚合。
- 不复制参考站 Logo、SEO 长文或受版权保护的独家文案。

## 10. 部署步骤

1. 在 Cloudflare 创建 Worker 项目并绑定 `f-movies.app`。
2. 使用 `wrangler secret put TMDB_READ_ACCESS_TOKEN` 写入密钥。
3. 设置 `PUBLIC_IMAGE_CDN_URL`，指向图片 Worker 自定义域名。
4. 执行 `npm run deploy`；Cloudflare 自动构建并发布 Astro Worker。
5. 图片 Worker 与 R2 缓存作为第二阶段部署，不影响主站首版上线。

## 11. 首版范围与后续工作

本次实现完成可浏览雏形、真实 TMDB 数据接入、响应式布局和部署配置。后续可增加预告片、演员页、多语言、收藏、PWA 与 R2 图片持久缓存。
