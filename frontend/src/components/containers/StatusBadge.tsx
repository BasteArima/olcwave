import Badge from '../ui/Badge'
import { useLanguage, type TranslationKey } from '../../i18n/useLanguage'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const statusVariants: Record<string, BadgeVariant> = {
  running: 'success',
  restarting: 'warning',
  created: 'info',
  paused: 'warning',
  exited: 'danger',
  dead: 'danger',
  removing: 'warning',
}

const statusKeys: Record<string, TranslationKey> = {
  running: 'running',
  restarting: 'restarting',
  created: 'created',
  paused: 'paused',
  exited: 'stopped',
  dead: 'dead',
  removing: 'removing',
}

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage()
  const variant = statusVariants[status] || 'default'
  const label = statusKeys[status] ? t(statusKeys[status]) : status
  return <Badge variant={variant} dot>{label}</Badge>
}
