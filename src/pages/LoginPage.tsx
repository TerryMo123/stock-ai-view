import { Button, Card, Form, Input, Typography, App } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { message } = App.useApp()
  const fromState = (location.state as { from?: string } | null)?.from
  const fromQuery = searchParams.get('from')
  const from = fromState || fromQuery || '/'

  if (!loading && user) {
    return <Navigate to={from.startsWith('/login') ? '/' : from} replace />
  }

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Stock AI View
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
          登录后查看背离列表、K 线与历史回测
        </Typography.Paragraph>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            try {
              await login(values.username, values.password)
              message.success('登录成功')
            } catch (e) {
              message.error(e instanceof Error ? e.message : '登录失败')
            }
          }}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="账号" size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
