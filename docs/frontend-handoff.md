# 前端项目交接说明（stock-ai-agent）

供新建 **React + TypeScript + Vite** 可视化项目时使用。后端仓库路径（本机示例）：

`/Applications/MAMP/nears/stock-ai-agent`

---

## 1. 产品目标

| 页面/功能 | 说明 |
|-----------|------|
| 背离列表 | 等价 CLI：`stock-backtest screen --from-db --days 15 --tf daily,weekly,monthly,yearly` |
| 单股详情 | 日 K + MACD（DIF/DEA/HIST）副图，可展示背离标记 |
| 同步状态 | 读 `sync_meta`：成功/失败、最近交易日、失败原因；可选展示覆盖率统计 |

**注意**：行情同步仍由后端 CLI / 定时任务完成；前端**不直连 MySQL**，通过 **FastAPI** 读库。

---

## 2. MySQL 库表（`stock_ai`）

连接配置见后端 `.env`：`MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`。

### `stock_info` — 股票基础信息

| 字段 | 类型 | 说明 |
|------|------|------|
| code | CHAR(6) PK | 证券代码 |
| name | VARCHAR(64) | 简称 |
| updated_at | DATETIME | 更新时间 |

### `stock_daily` — 日 K（前复权等）

| 字段 | 类型 | 说明 |
|------|------|------|
| code | CHAR(6) | 与 trade_date 联合主键 |
| trade_date | DATE | 交易日 |
| open_price, high_price, low_price, close_price | DECIMAL | OHLC |
| volume | BIGINT | 成交量 |
| amount | DECIMAL | 成交额 |
| adjust_type | VARCHAR(8) | 默认 `qfq` |
| source | VARCHAR(16) | 默认 `eastmoney` |

索引：`(trade_date)`、`(code, trade_date)`。

### `stock_indicator` — 技术指标（与 trade_date 对齐）

| 字段 | 类型 | 说明 |
|------|------|------|
| code, trade_date | | 联合主键 |
| macd_dif, macd_dea, macd_hist | DOUBLE | MACD |
| rsi | DOUBLE | RSI |
| volume_ratio | DOUBLE | 量比 |

### `macd_divergence` — 多周期 MACD 背离事件

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 自增主键 |
| code, name | | 代码、名称 |
| timeframe | VARCHAR(16) | `daily` / `weekly` / `monthly` / `half_year` / `yearly` |
| kind | VARCHAR(8) | `top` 顶背离 / `bottom` 底背离 |
| signal_date | DATE | 背离确认日（较晚极值日） |
| earlier_date, later_date | DATE | 两极值日期 |
| price_earlier, price_later | DECIMAL | 对应价格 |
| macd_earlier, macd_later | DOUBLE | 对应 MACD |
| macd_column | VARCHAR(16) | 默认 `macd_dif` |
| note | VARCHAR(255) | 备注 |
| detected_at | DATETIME | 入库检测时间 |

唯一键：`(code, timeframe, kind, signal_date)`。

筛选逻辑（与 CLI 一致）：`signal_date >= cutoff_date`，按 code/timeframe/kind 聚合展示。

### `sync_meta` — 单票同步状态

| 字段 | 类型 | 说明 |
|------|------|------|
| code | CHAR(6) PK | |
| last_trade_date | DATE | 已入库最近交易日 |
| last_sync_at | DATETIME | 上次同步时间 |
| status | VARCHAR(16) | 如 `ok` / `failed` / `pending` |
| message | VARCHAR(512) | 失败原因等 |

---

## 3. 建议 FastAPI 接口（初版）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/screen/divergence` | 背离列表；query: `days`, `tf`, `kinds`(top/bottom) |
| GET | `/api/stocks/{code}/daily` | 日 K；query: `start`, `end`, `limit` |
| GET | `/api/stocks/{code}/indicators` | 指标序列（与 K 线 date 对齐） |
| GET | `/api/stocks/{code}/divergence` | 单股背离历史；query: `tf`, `days` |
| GET | `/api/sync/summary` | `sync_meta` 按 status 计数 |
| GET | `/api/sync/failures` | 失败原因聚合（对标 `db-failures`） |
| GET | `/api/sync/failed` | 失败列表分页；query: `page`, `page_size` |

响应 JSON 字段名建议与表字段 snake_case 一致，日期用 ISO `YYYY-MM-DD`。

**后续可选**：`POST /api/sync/trigger` 触发补数（需鉴权，调用子进程跑 CLI）。

---

## 4. 后端 CLI 速查（数据从哪来）

| 场景 | 命令 |
|------|------|
| 首次全量 | `stock-backtest db-sync --pool all-a -w 4 -y 15` |
| 每日增量 | `stock-backtest db-sync --pool all-a --only-latest-day` |
| 补指定日 | `stock-backtest db-sync --pool all-a --repair-date 2025-05-27 -w 1` |
| 仅补失败 | `stock-backtest db-sync --pool all-a --repair-failed-only -w 1` |
| 库内筛选 | `stock-backtest screen --from-db --days 15 --tf daily,weekly,monthly,yearly` |

`db-sync` 各模式互斥；工作日 15:10 前会自动截止到上一交易日（未指定 `--repair-date` 时）。

完整说明见后端仓库 `README.md` 末尾「命令速查」。

---

## 5. 前端技术栈建议

- **React + TypeScript + Vite**
- 图表：**ECharts** 或 **KLineCharts**（K 线 + MACD 副图）
- 请求：**TanStack Query** + `fetch` / axios
- UI：Ant Design 或 shadcn/ui
- 桌面（二期）：**Tauri 2** 打包 Windows，共用同一套前端

---

## 6. 新会话开场模板（复制到 Cursor）

```text
我要做 stock-ai-agent 的可视化前端，请阅读本仓库 docs/frontend-handoff.md（若已复制到本项目则读本地副本）。

技术栈：React + TypeScript + Vite（后续 Tauri）。
请初始化 Vite 项目，并给出 FastAPI 与前端页面结构的实现计划。
后端 Python 仓库：/Applications/MAMP/nears/stock-ai-agent
```

---

## 7. 关联文件（后端）

| 路径 | 用途 |
|------|------|
| `src/stock_ai_agent/db/schema.sql` | 建表 SQL 源文件 |
| `src/stock_ai_agent/db/repository.py` | 查询逻辑参考 |
| `src/stock_ai_agent/cli.py` | `screen --from-db`、`db-sync` 参数 |
| `README.md` | 部署与命令速查 |
