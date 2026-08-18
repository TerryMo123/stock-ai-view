import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DivergenceListPage } from '@/pages/DivergenceListPage'
import { StockDetailPage } from '@/pages/StockDetailPage'
import { SyncStatusPage } from '@/pages/SyncStatusPage'
import { BacktestPage } from '@/pages/BacktestPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <DivergenceListPage /> },
        { path: 'backtest', element: <BacktestPage /> },
        { path: 'sync', element: <SyncStatusPage /> },
        { path: ':code', element: <StockDetailPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
