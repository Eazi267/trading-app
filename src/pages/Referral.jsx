import { useState } from 'react'
import { Copy, Check, Gift, Users } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Referral() {
  const { currentUser, getReferrals } = useAuth()
  const [copied, setCopied] = useState(false)

  const referralLink = `${window.location.origin}/signup?ref=${currentUser.referralCode}`
  const referrals = getReferrals(currentUser.id)

  function handleCopy() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout pageTitle="Referrals">
      <h1 className="page-title">Refer a friend</h1>
      <p className="page-sub">Share your code — anyone who signs up with it shows up here.</p>

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
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}