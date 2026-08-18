# 后端 API 交接（FastAPI）

前端仓库副本，完整实现见 **stock-ai-agent**：

`/Applications/MAMP/nears/stock-ai-agent/src/stock_ai_agent/api/`

## 安装与启动

```bash
cd /Applications/MAMP/nears/stock-ai-agent
source .venv/bin/activate
pip install -e ".[api]"
stock-api
# 默认 http://127.0.0.1:8000
```

MySQL 配置沿用后端 `.env`（`MYSQL_*`）。

## 路由一览

与 [frontend-handoff.md](./frontend-handoff.md) §3 一致，已实现：

- `GET /api/health`
- `GET /api/screen/divergence?days=&tf=&kinds=`
- `GET /api/stocks/{code}/daily?start=&end=&limit=`
- `GET /api/stocks/{code}/indicators?start=&end=&limit=`
- `GET /api/stocks/{code}/divergence?tf=&days=&kinds=`
- `GET /api/sync/summary`
- `GET /api/sync/failures?limit=`
- `GET /api/sync/failed?page=&page_size=`

OpenAPI 文档：启动后访问 http://127.0.0.1:8000/docs

## Repository 扩展

`MarketRepository` / `DivergenceRepository` 新增只读方法供 API 使用，详见 `db/repository.py`：

- `load_daily_range`, `load_indicators_range`
- `sync_status_counts`, `sync_meta_total`, `list_sync_failed`
- `DivergenceRepository.query_for_stock`
