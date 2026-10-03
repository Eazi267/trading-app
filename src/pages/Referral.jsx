import { useState, useEffect } from 'react'
import { Copy, Check, Gift, Users } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export default function Referral() {
  const { currentUser, getReferrals } = useAuth()
  const { transactions, getActiveReferralCampaign } = useApp()
  const { settings } = useSettings()
  const [copied, setCopied] = useState(false)
  // getReferrals is a real network call now, not a synchronous local
  // filter — fetched once on mount (and whenever the user changes)
  // rather than called during render.
  const [referrals, setReferrals] = useState([])
  useEffect(() => {
    let cancelled = false
    getReferrals(currentUser.id).then((result) => { if (!cancelled) setReferrals(result) })
    return () => { cancelled = true }
  }, [currentUser.id, getReferrals])

  if (!settings.showReferrals) {
    return (
      <Layout pageTitle="Referrals">
        <div className="empty-state"><p>The referral program isn't available right now.</p></div>
      </Layout>
    )
  }

  const referralLink = `${window.location.origin}/signup?ref=${currentUser.referralCode}`
  const liveCampaign = getActiveReferralCampaign()
  // Bonuses this specific client has actually earned — real
  // transactions, not a counter, so it can never show a number that
  // doesn't match their own Balance/Transaction History.
  const earnedBonuses = transactions.filter((t) => t.type === 'referral_bonus' && t.userId === currentUser.id)

  function handleCopy() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout pageTitle="Referrals">
      <h1 className="page-title">Refer a friend</h1>
      <p className="page-sub">Share your code — anyone who signs up with it shows up here.</p>

      {liveCampaign && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--success)' }}>
          <div className="panel-head"><h3><Gift size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{liveCampaign.name}</h3></div>
          <p style={{ padding: '0 20px 16px', fontSize: 13.5 }}>
            Earn <strong>{formatMoney(liveCampaign.bonusAmount)}</strong> the moment someone you refer makes their
            first deposit — credited automatically, through {formatDate(liveCampaign.endDate)}.
          </p>
        </div>
      )}

      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="panel-head">
          <h3><Gift size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Your referral code</h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 22, letterSpacing: 2,
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '14px 16px', textAlign: 'center', marginBottom: 14
          }}>
            {currentUser.referralCode}
          </div>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Shareable link</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={referralLink}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
            <button className="tx-btn deposit" style={{ flex: 'none', padding: '10px 16px' }} onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3><Users size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Your referrals ({referrals.length})</h3>
        </div>
        {referrals.length === 0 ? (
          <div className="empty-state"><p>No one has signed up with your code yet.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {referrals.map((r) => (
              <div key={r.id} className="entity-card">
                <div className="icon-badge" style={{ fontSize: 12, fontWeight: 700 }}>
                  {(r.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="entity-card-body">
                  <div className="entity-card-title">{r.name}</div>
                  <div className="entity-card-meta">
                    <span>{r.email}</span>
                    <span>Joined {formatDate(r.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3><Gift size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Bonuses earned ({earnedBonuses.length})</h3>
        </div>
        {earnedBonuses.length === 0 ? (
          <div className="empty-state"><p>No referral bonuses yet — they're credited automatically once someone you refer makes their first deposit during a live campaign.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {earnedBonuses.map((b) => (
              <div key={b.id} className="entity-card entity-card-accent-profit">
                <div className="icon-badge"><Gift size={17} /></div>
                <div className="entity-card-body">
                  <div className="entity-card-title">{b.campaignName}</div>
                  <div className="entity-card-meta">
                    <span>Referred {b.referredUserName}</span>
                    <span>{formatDate(b.date)}</span>
                  </div>
                </div>
                <div className="pnl-up" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, flex: 'none' }}>
                  +{formatMoney(b.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}