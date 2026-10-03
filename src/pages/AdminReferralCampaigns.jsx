import { useState } from 'react'
import { Gift, Plus, Power } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CollapsiblePanel from '../components/CollapsiblePanel.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const inputStyle = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }
const labelStyle = { fontSize: 11.5, color: 'var(--text-muted)' }

// A campaign's real-world status, derived fresh every render from
// its own active flag + date window — never a separate stored status
// field that could drift out of sync with the dates.
function campaignStatus(campaign) {
  const now = new Date()
  const start = new Date(campaign.startDate)
  const end = new Date(campaign.endDate + 'T23:59:59')
  if (!campaign.active) return { label: 'Paused', className: 'status-rejected' }
  if (now < start) return { label: 'Scheduled', className: 'status-pending' }
  if (now > end) return { label: 'Ended', className: 'status-rejected' }
  return { label: 'Active', className: 'status-approved' }
}

export default function AdminReferralCampaigns() {
  const { referralCampaigns, createReferralCampaign, setCampaignActive, getActiveReferralCampaign, getCampaignStats } = useApp()
  const { settings } = useSettings()

  const [name, setName] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  if (!settings.showReferrals) {
    return (
      <Layout pageTitle="Referral Campaigns">
        <div className="empty-state">
          <p>The referral program is turned off for this deployment. Turn it on in Business Settings to use this tool.</p>
        </div>
      </Layout>
    )
  }

  const liveCampaign = getActiveReferralCampaign()

  async function handleCreate() {
    setError('')
    setCreated(false)
    const result = await createReferralCampaign({
      name,
      bonusAmount: parseFloat(bonusAmount),
      startDate,
      endDate,
      note
    })
    if (result.error) {
      setError(result.error)
      return
    }
    setName('')
    setBonusAmount('')
    setStartDate(todayStr())
    setEndDate('')
    setNote('')
    setCreated(true)
  }

  return (
    <Layout pageTitle="Referral Campaigns">
      <h1 className="page-title">Referral Campaigns</h1>
      <p className="page-sub">
        Set up a bonus window (e.g. a Christmas Bonus). The referrer earns the bonus automatically the moment
        someone they referred makes their first approved deposit — no separate approval step.
      </p>

      {liveCampaign ? (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--success)' }}>
          <div className="panel-head"><h3><Gift size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Currently live</h3></div>
          <p style={{ padding: '0 20px 16px', fontSize: 13.5 }}>
            <strong>{liveCampaign.name}</strong> — {formatMoney(liveCampaign.bonusAmount)} per qualifying referral,
            through {formatDate(liveCampaign.endDate)}.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 16 }}>
          <p style={{ padding: '16px 20px', fontSize: 13.5, color: 'var(--text-muted)' }}>
            No campaign is live right now — referrals won't pay a bonus until one is active and inside its date window.
          </p>
        </div>
      )}

      {/* Collapsed by default — this is an occasional-use form, not
          something that needs to occupy screen space every time an
          admin just wants to check what's live or pause something. */}
      <CollapsiblePanel title="New campaign" style={{ marginBottom: 16 }}>
        {error && <div className="form-error" style={{ margin: '16px 20px 0' }}>{error}</div>}
        {created && <div style={{ margin: '16px 20px 0', fontSize: 13, color: 'var(--success)' }}>Campaign created.</div>}
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={labelStyle}>
            Campaign name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Christmas Bonus"'
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Bonus amount (USD)
            <input
              type="number"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            End date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Internal note (optional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Not shown to clients"
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <button className="tx-btn deposit" style={{ padding: '9px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleCreate}>
            <Plus size={14} /> Create campaign
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 16px 16px', margin: 0 }}>
          Only one campaign needs to be live at a time, but past campaigns stay listed below for the record —
          bonuses already paid out are never affected by pausing or ending a campaign afterward.
        </p>
      </CollapsiblePanel>

      <div className="panel">
        <div className="panel-head"><h3>All campaigns ({referralCampaigns.length})</h3></div>
        {referralCampaigns.length === 0 ? (
          <div className="empty-state"><p>No campaigns created yet.</p></div>
        ) : (
          <div style={{ padding: 16 }}>
            {referralCampaigns.map((c) => {
              const status = campaignStatus(c)
              const stats = getCampaignStats(c.id)
              return (
                <div key={c.id} className={'entity-card' + (c.active ? ' entity-card-accent-profit' : '')}>
                  <div className="icon-badge"><Gift size={17} /></div>
                  <div className="entity-card-body">
                    <div className="entity-card-title">
                      {c.name} <span className={'status-pill ' + status.className} style={{ marginLeft: 8 }}>{status.label}</span>
                    </div>
                    <div className="entity-card-meta">
                      <span>{formatMoney(c.bonusAmount)} bonus</span>
                      <span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span>
                      <span>{stats.count} referral{stats.count === 1 ? '' : 's'} · {formatMoney(stats.totalPaid)} paid</span>
                      {c.note && <span>{c.note}</span>}
                    </div>
                  </div>
                  <button
                    className="tx-btn"
                    style={{ padding: '7px 12px', fontSize: 12.5, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setCampaignActive(c.id, !c.active)}
                  >
                    <Power size={13} /> {c.active ? 'Pause' : 'Reactivate'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
