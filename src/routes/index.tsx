import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DivergenceListPage } from '@/pages/DivergenceListPage'
import { StockDetailPage } from '@/pages/StockDetailPage'
import { SyncStatusPage } from '@/pages/SyncStatusPage'
import { BacktestPage } from '@/pages/BacktestPage'
import { LoginPage } from '@/pages/LoginPage'
import { AdminPage } from '@/pages/AdminPage'
import { RequireAdmin, RequireAuth } from '@/auth/RequireAuth'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: (
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      ),
      children: [
        { index: true, element: <DivergenceListPage /> },
        { path: 'backtest', element: <BacktestPage /> },
        {
          path: 'sync',
          element: (
            <RequireAdmin>
              <SyncStatusPage />
            </RequireAdmin>
          ),
        },
        {
          path: 'admin',
          element: (
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          ),
        },
        { path: ':code', element: <StockDetailPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
