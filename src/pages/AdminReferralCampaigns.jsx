import { useState } from 'react'
import { Gift, Plus, Power } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const todayStr = () => new Date().toISOString().slice(0, 10)

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
      <header className="dz-head">
        <h1 className="dz-title">Referral Campaigns</h1>
        <div className="dz-muted">Set up a bonus window (e.g. a Christmas Bonus). The referrer earns the bonus automatically the moment someone they referred makes their first approved deposit, with no separate approval step.</div>
      </header>

      <div className={'dz-card rf-campaign' + (liveCampaign ? ' sc-live' : '')}>
        <div className="icon-badge"><Gift size={17} /></div>
        <div>
          {liveCampaign ? (
            <>
              <strong>Live now: {liveCampaign.name}</strong>
              <p className="dz-muted" style={{ margin: '2px 0 0' }}>{formatMoney(liveCampaign.bonusAmount)} per qualifying referral, through {formatDate(liveCampaign.endDate)}.</p>
            </>
          ) : (
            <>
              <strong>No campaign is live</strong>
              <p className="dz-muted" style={{ margin: '2px 0 0' }}>Referrals won't pay a bonus until one is active and inside its date window.</p>
            </>
          )}
        </div>
      </div>

      <div className="dz-grid">
        <div className="dz-main">
          <div className="dz-card">
            <div className="dz-card-head"><h3>All campaigns ({referralCampaigns.length})</h3></div>
            {referralCampaigns.length === 0 ? (
              <div className="dz-empty">No campaigns created yet.</div>
            ) : (
              <div className="rf-list">
                {referralCampaigns.map((c) => {
                  const status = campaignStatus(c)
                  const stats = getCampaignStats(c.id)
                  return (
                    <div key={c.id} className="rf-item sc-row">
                      <span className="rf-av"><Gift size={15} /></span>
                      <span className="rf-who">
                        <strong>{c.name} <span className={'status-pill ' + status.className} style={{ marginLeft: 6 }}>{status.label}</span></strong>
                        <span className="dz-muted">{formatMoney(c.bonusAmount)} bonus · {formatDate(c.startDate)} – {formatDate(c.endDate)}</span>
                        <span className="dz-muted">{stats.count} referral{stats.count === 1 ? '' : 's'} · {formatMoney(stats.totalPaid)} paid{c.note ? ` · ${c.note}` : ''}</span>
                      </span>
                      <button type="button" className="dz-btn-o" onClick={() => setCampaignActive(c.id, !c.active)}>
                        <Power size={13} /> {c.active ? 'Pause' : 'Reactivate'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="dz-side">
          <div className="dz-card">
            <div className="dz-card-head"><h3><Plus size={15} className="st-ico" />New campaign</h3></div>
            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
            {created && <div className="st-ok" style={{ marginBottom: 12 }}>Campaign created.</div>}
            <div className="st-form sc-form1">
              <label className="st-f">
                <span className="pg-label">Campaign name</span>
                <input className="pg-field" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Christmas Bonus"' />
              </label>
              <label className="st-f">
                <span className="pg-label">Bonus amount (USD)</span>
                <input className="pg-field" type="number" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} placeholder="0.00" />
              </label>
              <label className="st-f">
                <span className="pg-label">Start date</span>
                <input className="pg-field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="st-f">
                <span className="pg-label">End date</span>
                <input className="pg-field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              <label className="st-f st-wide">
                <span className="pg-label">Internal note (optional)</span>
                <input className="pg-field" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not shown to clients" />
              </label>
            </div>
            <button type="button" className="btn-primary pg-start-btn" onClick={handleCreate}><Plus size={14} /> Create campaign</button>
            <p className="dz-muted st-hint">Only one campaign needs to be live at a time. Past campaigns stay listed for the record, and bonuses already paid are never affected by pausing or ending one.</p>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
