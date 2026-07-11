import {
  Zap, TrendingUp, TrendingDown, Trophy, ArrowDownCircle, ArrowUpCircle,
  Wallet, Award, Layers, Bell
} from 'lucide-react'

// One source of truth for how each notification type looks — icon
// and color class. Both the toast popups and the persisted
// notification list (bell dropdown + full history page) read from
// this, so a "trade closed in profit" toast and its later history
// entry always match.
export const NOTIFICATION_META = {
  trade_opened: { icon: Zap, colorVar: 'var(--accent-bright)' },
  trade_closed_profit: { icon: TrendingUp, colorVar: 'var(--success)' },
  trade_closed_loss: { icon: TrendingDown, colorVar: 'var(--danger)' },
  session_settled_profit: { icon: Trophy, colorVar: 'var(--success)' },
  session_settled_loss: { icon: TrendingDown, colorVar: 'var(--danger)' },
  deposit_approved: { icon: ArrowDownCircle, colorVar: 'var(--success)' },
  withdrawal_approved: { icon: ArrowUpCircle, colorVar: 'var(--accent-bright)' },
  balance_update: { icon: Wallet, colorVar: 'var(--text-secondary)' },
  achievement: { icon: Award, colorVar: '#fbbf24' },
  tier_changed: { icon: Layers, colorVar: 'var(--accent-bright)' }
}

export function getNotificationMeta(type) {
  return NOTIFICATION_META[type] || { icon: Bell, colorVar: 'var(--text-secondary)' }
}
