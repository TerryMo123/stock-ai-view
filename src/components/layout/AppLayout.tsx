import { Button, Drawer, Grid, Layout, Menu, Typography } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'

const { Header, Content, Sider } = Layout

const SIDER_WIDTH = 220

const navItems = [
  { key: '/', label: <Link to="/">MACD 背离列表</Link> },
  { key: '/backtest', label: <Link to="/backtest">历史回测</Link> },
  { key: '/sync', label: <Link to="/sync">数据同步面板</Link> },
]

export function AppLayout() {
  const screens = Grid.useBreakpoint()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const selected = ['/sync', '/backtest', '/'].includes(pathname)
    ? [pathname === '/sync' ? '/sync' : pathname === '/backtest' ? '/backtest' : '/']
    : []
  const isMobile = !screens.md

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selected}
      items={navItems}
      onClick={() => setDrawerOpen(false)}
      style={{ borderInlineEnd: 'none' }}
    />
  )

  return (
    <Layout className="app-layout-root">
      {!isMobile && (
        <Sider
          width={SIDER_WIDTH}
          theme="dark"
          className="app-sider-fixed"
          style={{ width: SIDER_WIDTH, maxWidth: SIDER_WIDTH, minWidth: SIDER_WIDTH }}
        >
          <div className="app-sider-inner">
            <div className="app-sider-brand">Stock AI View</div>
            <div className="app-sider-menu">{menu}</div>
          </div>
        </Sider>
      )}
      <Layout
        className="app-main-layout"
        style={!isMobile ? { marginLeft: SIDER_WIDTH } : undefined}
      >
        <Header
          className="app-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingInline: 16,
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              aria-label="打开菜单"
            />
          )}
          <Typography.Text style={{ fontWeight: 600, fontSize: 16 }}>Stock AI View</Typography.Text>
        </Header>
        <Content
          className="app-content"
          style={{ padding: isMobile ? 12 : 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}
        >
          <Outlet />
        </Content>
      </Layout>
      <Drawer
        title="Stock AI View"
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0, background: '#001529', overflow: 'auto' } }}
      >
        {menu}
      </Drawer>
    </Layout>
  )
}
