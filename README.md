# Stock AI View

`stock-ai-agent` 的可视化前端：背离列表、单股 K 线 + MACD、同步状态。

## 技术栈

- React 18 + TypeScript + Vite 5
- Ant Design、TanStack Query、ECharts
- 二期可选：Tauri 2 桌面壳（共用本仓库 `src/`）

## 开发

```bash
npm install
cp .env.example .env   # 默认代理到 ECS：http://47.98.235.248
npm run dev
```

浏览器打开 http://localhost:5173 。开发时 `/api` 由 Vite 代理到 `VITE_API_PROXY`（默认本机 `stock-api`）。

生产构建：`npm run build` 使用 `.env.production` 的 `VITE_BASE_PATH=/stock/`，接口走同源 `/stock/api`（由 `moyong-gateway` 反代）。

Docker 见 `stock-ai-agent/docker-compose.prod.yml` 与 `moyong-gateway`。

## 目录结构

见 [docs/architecture.md](./docs/architecture.md)。

## 关联

- 后端 CLI / MySQL：`/Applications/MAMP/nears/stock-ai-agent`
- 交接说明：[docs/frontend-handoff.md](./docs/frontend-handoff.md)
