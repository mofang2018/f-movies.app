# TMDB API 批量同步设计

## 目标

将目前的“TMDB 官网页面快照”升级为 API 驱动的数据同步系统：站点运行时从自己的数据仓库读取元数据，TMDB API 仅由后台同步任务访问；海报、背景和演员头像持久保存到 Cloudflare R2。

本方案只同步电影、剧集和人物元数据，不下载、托管或提供任何视频文件。

## 结论与边界

- 不把 TMDB 当作每个访客请求时的实时后端；访客流量不会直接消耗 TMDB API 配额。
- 不尝试用 API “完整镜像所有 TMDB 条目”。TMDB 条目规模持续变化，完整目录应使用官方 daily export 作为清单源；本项目采用 API 构建“站点可浏览目录”。
- 首次导入采用可暂停、可续跑的任务队列；后续仅处理热门列表和 Changes API 返回的变更 ID。
- 以 **3 请求/秒、最多 4 个并发请求** 为默认安全上限，低于 TMDB 所述约 `40 请求 / 10 秒` 的动态限流建议。`429` 时严格依据 `Retry-After` 暂停并退避。

## 架构

```text
Cloudflare Cron
  │
  ├─ seed Worker：拉取列表、Changes API、生成去重任务
  │                  │
  │                  └─ Cloudflare Queue（media-sync / image-ingest）
  │                                      │
  ├──────────────────────────────────────┘
  │
Queue Consumer Worker
  ├─ TMDB API（限速、429 退避、重试）
  ├─ D1：媒体、演员、类型、同步状态
  └─ R2：原始 poster / backdrop / profile 图片
                         │
浏览器 -> Astro Worker -> D1 -> 图片 Worker -> R2 -> Cloudflare 图片转换缓存
```

Astro 页面只读取 D1；D1 暂时不可用或数据尚未覆盖的页面才回退到现有 `src/data/tmdb-snapshot.json`。这保留了本地开发和故障降级能力。

## 同步范围

### 首次导入：建议的可浏览目录

先导入约 **5,000 个电影 + 3,000 个剧集**，按热门度和近年作品覆盖。这个规模足够支撑首页、搜索、类型、国家和详情页，同时易于控制存储与同步时间。

种子来源：

- `/trending/all/day`、`/trending/all/week`
- `/movie/popular`、`/movie/now_playing`、`/movie/top_rated`
- `/tv/popular`、`/tv/on_the_air`、`/tv/top_rated`
- `/discover/movie`、`/discover/tv`：按年份区间、类型、国家和 `popularity.desc` 分页补齐
- `/genre/movie/list`、`/genre/tv/list`、`/configuration`：每天更新一次

每个去重后的媒体条目调用一次详情接口：

```text
/movie/{id}?append_to_response=credits,external_ids
/tv/{id}?append_to_response=credits,external_ids
```

详情请求已经返回页面所需的海报、背景、简介、类型、评分、上映日期和前 10 位演员；不请求 `images`、`videos`、`translations` 等当前页面不使用的大响应字段。

以 3 请求/秒估算，8,000 个详情请求约需 45 分钟；任务由 Queue 消费，不受单次 HTTP 请求时长限制。首次导入可随时停止，下次从 D1 中未完成的任务继续。

### 日常增量同步

| 频率 | 工作 | 预期 API 消耗 |
| --- | --- | --- |
| 首轮回填期间每 15 分钟 | 首页与各热门列表的下一页（D1 持久游标，循环至第 500 页）；每轮最多 25 条 | 约 33 请求 / 轮 |
| 达到目录目标后每小时 | 首页与各热门列表第 1 页、变更条目 | 约 20–30 请求 |
| 每天 | 类型、配置、榜单补页 | 少量请求 |
| 每天 | `/movie/changes` 与 `/tv/changes`，仅入队站点已收录 ID | 取决于变更量 |
| 每周 | 对 30 天未更新的高访问详情做轮换复查 | 按预算限额执行 |

`Changes` 接口仅用于找出发生变化的 ID。消费者只更新本地 D1 已收录的 ID，避免单日变更量导致全库重新抓取。

## 限速与重试

所有 API 请求必须经过共享限速器，不能由每个 Worker 自己独立计数。

推荐参数：

```text
rate:          3 requests / second
burst:         6 requests
concurrency:   4
timeout:       15 seconds
max attempts:  5
```

处理规则：

1. `200–299`：写入 D1，必要时入队图片任务。
2. `404`：标记条目为 `not_found`，30 天后才允许重新检查。
3. `401/403`：停止本次同步并告警；这通常是 Token 或权限配置问题。
4. `429`：读取 `Retry-After`；没有该头时采用 60、120、240、480 秒指数退避并加入随机抖动。任务不丢弃。
5. `5xx` 或网络超时：指数退避，最多重试 5 次；之后写入失败表，下一轮 Cron 再试。

Cloudflare 侧的跨实例令牌桶使用一个轻量 Durable Object；同步 Queue 的消费者向该对象申请令牌。这样并发消费者不会叠加超过 TMDB 的限速。

## D1 数据模型

初版只存页面直接使用的字段，避免不必要的全量 TMDB JSON。

```sql
CREATE TABLE media (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT NOT NULL DEFAULT '',
  release_date TEXT NOT NULL DEFAULT '',
  vote_average REAL NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  popularity REAL NOT NULL DEFAULT 0,
  poster_path TEXT,
  backdrop_path TEXT,
  runtime INTEGER,
  seasons INTEGER,
  status TEXT,
  updated_at TEXT NOT NULL,
  tmdb_updated_at TEXT,
  PRIMARY KEY (media_type, tmdb_id)
);

CREATE TABLE media_genres (
  media_type TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (media_type, tmdb_id, genre_id)
);

CREATE TABLE media_cast (
  media_type TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  character_name TEXT NOT NULL DEFAULT '',
  profile_path TEXT,
  cast_order INTEGER NOT NULL,
  PRIMARY KEY (media_type, tmdb_id, person_id)
);

CREATE TABLE sync_jobs (
  job_key TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);
```

需要的索引：`media(title)`、`media(popularity DESC)`、`media(vote_average DESC)`、`media(release_date DESC)` 和 `media_genres(genre_id)`。搜索量变大后，再将标题搜索迁移到 D1 FTS5 或 Cloudflare Vectorize；首版不必引入。

## R2 图片策略

对象 Key 保留 TMDB 路径并带资源分类，便于去重与审计：

```text
tmdb/poster/original/<filename>.jpg
tmdb/backdrop/original/<filename>.jpg
tmdb/profile/original/<filename>.jpg
```

规则：

- R2 只存一份原始图；`w185/w342/w500/w780/w1280` 由图片 Worker 在读取时使用 Cloudflare Image Resizing 转换，并用边缘缓存保存。
- 首次详情写入时，poster 和 backdrop 在同一媒体 Queue 消费中直接预热到 R2；不为每张图额外创建 Queue 消息。演员头像只在详情页第一次访问时按需缓存，避免为低访问条目写入大量 R2 对象。
- 入库前校验 HTTPS 源、响应 `Content-Type: image/*`、最大大小（poster/profile 8 MB，backdrop 16 MB）与 HTTP 状态。
- R2 命中直接返回；R2 未命中时仅回源 TMDB 一次，成功后写入 R2。对 404 维护短期负缓存，防止反复请求坏路径。
- 保留 TMDB 归属声明；R2 是应用缓存，不作为独立图片素材库或公开下载接口。

## Worker 与队列拆分

| 组件 | 职责 |
| --- | --- |
| `catalog-sync` Scheduled Worker | 生成种子、读取 Changes API、将任务写入 Queue |
| `catalog-consumer` Queue Consumer | 限速调用详情 API，事务写入 D1，投递图片任务 |
| `image-consumer` Queue Consumer | 下载、校验并写入 R2 |
| `image-proxy` Worker | R2 读取、按尺寸转换、边缘缓存、按需回填 |
| Astro Worker | 读取 D1 并渲染站点，不调用批量同步接口 |

消息应是幂等的：`media:movie:123`、`media:tv:456`、`image:poster:abc.jpg`。D1 中的 `sync_jobs` 唯一键可消除重复投递；媒体写入使用 UPSERT，图片写入使用 R2 条件写入。

## 运维与观察

每次运行写入 `sync_runs` 记录：开始/结束时间、请求数、429 数、成功/失败条目、入队数、R2 写入量和最新错误。设置以下告警：

- 连续 3 次 Cron 失败；
- 15 分钟内 429 超过 5 次；
- Queue backlog 超过设定阈值；
- D1 写入失败或 Token 401/403；
- R2 图片验证失败率超过 2%。

管理入口只提供内部 Worker Route 或受 Cloudflare Access 保护的端点，例如：`POST /admin/sync/backfill?type=movie&limit=500`。不在公开 Astro 页面暴露同步触发器、TMDB Token 或 Queue 状态。

## 实施顺序

1. 创建 D1、R2、两个 Queue 和限速 Durable Object；将绑定写入独立 `wrangler.sync.jsonc`。
2. 实现 API 客户端、限速器、D1 migration 与 `catalog-sync` / `catalog-consumer`，先同步 100 个条目验证。
3. 实现 R2 图片消费者和改造 `image-proxy`，完成命中、回填、校验和负缓存。
4. 将 Astro `TmdbClient` 改成 D1-first；现有 JSON 快照仅作为故障回退。
5. 以 500、2,000、8,000 条的阶梯批次运行回填，观察 429、Queue backlog、R2 费用和页面质量后再扩大。

## 配置与安全

```bash
# 仅 Worker Secret，不提交到仓库
npx wrangler secret put TMDB_READ_ACCESS_TOKEN --config wrangler.sync.jsonc

# 建议的绑定名称
CATALOG_DB       # D1
TMDB_IMAGES      # R2
MEDIA_SYNC_QUEUE # Queue producer / consumer
IMAGE_INGEST_QUEUE
TMDB_RATE_LIMITER # Durable Object
```

本地 CLI 批量同步也只从 `.env` 读取 `TMDB_READ_ACCESS_TOKEN`。`.env` 已被 `.gitignore` 排除；GitHub Actions 若后续启用，Token 只能放在 GitHub Secret 中，不能写入仓库或构建产物。
