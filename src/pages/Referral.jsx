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
      <header className="dz-head">
        <h1 className="dz-title">Refer a friend</h1>
        <div className="dz-muted">Share your code. Anyone who signs up with it shows up here.</div>
      </header>

      {liveCampaign && (
        <div className="dz-card rf-campaign">
          <div className="icon-badge"><Gift size={17} /></div>
          <div>
            <strong>{liveCampaign.name}</strong>
            <p className="dz-muted" style={{ margin: '2px 0 0' }}>
              Earn <strong className="mono">{formatMoney(liveCampaign.bonusAmount)}</strong> the moment someone you refer makes their first deposit. Credited automatically, through {formatDate(liveCampaign.endDate)}.
            </p>
          </div>
        </div>
      )}

      <div className="dz-grid rf-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head"><h3>Your referral code</h3></div>
            <div className="rf-code mono">{currentUser.referralCode}</div>
            <span className="pg-label">Shareable link</span>
            <div className="rf-link">
              <input className="pg-field" readOnly value={referralLink} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-primary rf-copy" onClick={handleCopy} aria-label="Copy link">
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
              </button>
            </div>
          </div>

          <div className="dz-card">
            <div className="dz-card-head"><h3><Users size={15} className="st-ico" />Your referrals ({referrals.length})</h3></div>
            {referrals.length === 0 ? (
              <div className="dz-empty">No one has signed up with your code yet.</div>
            ) : (
              <div className="rf-list">
                {referrals.map((r) => (
                  <div key={r.id} className="rf-item">
                    <div className="rf-av">{(r.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div className="rf-who">
                      <strong>{r.name}</strong>
                      <span className="dz-muted">{r.email}</span>
                    </div>
                    <span className="dz-muted rf-date">Joined {formatDate(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3>How it works</h3></div>
            <ol className="pg-steps">
              <li><b>1</b><span>Send your link or code to a friend.</span></li>
              <li><b>2</b><span>They sign up with it.</span></li>
              <li><b>3</b><span>When they make a first deposit during a live campaign, your bonus is credited automatically.</span></li>
            </ol>
          </div>

          <div className="dz-card">
            <div className="dz-card-head"><h3><Gift size={15} className="st-ico" />Bonuses earned ({earnedBonuses.length})</h3></div>
            {earnedBonuses.length === 0 ? (
              <div className="dz-empty">No referral bonuses yet.</div>
            ) : (
              <div className="rf-list">
                {earnedBonuses.map((b) => (
                  <div key={b.id} className="rf-item">
                    <div className="rf-who">
                      <strong>{b.campaignName}</strong>
                      <span className="dz-muted">Referred {b.referredUserName} · {formatDate(b.date)}</span>
                    </div>
                    <span className="pnl-up mono">+{formatMoney(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </Layout>
  )
}
