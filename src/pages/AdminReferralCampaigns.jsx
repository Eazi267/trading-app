import { useState } from 'react'
import { Gift, Plus, Power } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useApp } from '../context/AppContext.jsx'

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

  const [name, setName] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const liveCampaign = getActiveReferralCampaign()

  function handleCreate() {
    setError('')
    setCreated(false)
    const result = createReferralCampaign({
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

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>New campaign</h3></div>
        {error && <div className="form-error" style={{ margin: '16px 20px 0' }}>{error}</div>}
        {created && <div style={{ margin: '16px 20px 0', fontSize: 13, color: 'var(--success)' }}>Campaign created.</div>}
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Campaign name (e.g. "Christmas Bonus")'
            style={{ flex: '1 1 220px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <input
            type="number"
            value={bonusAmount}
            onChange={(e) => setBonusAmount(e.target.value)}
            placeholder="Bonus amount (USD)"
            style={{ width: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note (optional)"
            style={{ flex: '1 1 200px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <button className="tx-btn deposit" style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleCreate}>
            <Plus size={14} /> Create campaign
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 16px' }}>
          Only one campaign needs to be live at a time, but past campaigns stay listed below for the record —
          bonuses already paid out are never affected by pausing or ending a campaign afterward.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>All campaigns ({referralCampaigns.length})</h3></div>
        {referralCampaigns.length === 0 ? (
          <div className="empty-state"><p>No campaigns created yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Bonus</th><th>Window</th><th>Status</th><th>Paid out</th><th></th></tr>
            </thead>
            <tbody>
              {referralCampaigns.map((c) => {
                const status = campaignStatus(c)
                const stats = getCampaignStats(c.id)
                return (
                  <tr key={c.id}>
                    <td>{c.name}{c.note ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.note}</div> : null}</td>
                    <td>{formatMoney(c.bonusAmount)}</td>
                    <td>{formatDate(c.startDate)} – {formatDate(c.endDate)}</td>
                    <td><span className={'status-pill ' + status.className}>{status.label}</span></td>
                    <td>{stats.count} referral{stats.count === 1 ? '' : 's'} · {formatMoney(stats.totalPaid)}</td>
                    <td>
                      <button
                        className="tx-btn"
                        style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setCampaignActive(c.id, !c.active)}
                      >
                        <Power size={13} /> {c.active ? 'Pause' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
