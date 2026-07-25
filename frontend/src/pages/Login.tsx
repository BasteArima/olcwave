import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useLanguage } from '../i18n/useLanguage'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { BoltIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ username, password })
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/15 text-accent mb-4 shadow-glow">
            <BoltIcon className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">{t('appName')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('signInTitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-secondary border border-border rounded-xl shadow-elevated p-6 space-y-4"
        >
          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5 text-sm text-danger animate-fade-in">
              <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Input
            label={t('username')}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoComplete="username"
            required
          />
          <Input
            label={t('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password')}
            autoComplete="current-password"
            required
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            {t('signIn')}
          </Button>
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          {t('footerAdminPanel')}
        </p>
      </div>
    </div>
  )
}
