import { useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import Configurator from './Configurator.jsx'
import ToastContainer from './ToastContainer.jsx'
import RippleEffect from './RippleEffect.jsx'

export default function Layout({ pageTitle, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Belt-and-suspenders alongside .sidebar's own overflow-y:auto —
  // iOS Safari specifically has a history of "scroll chaining" where
  // touch-scrolling can still leak through a fixed-position overlay
  // to the page underneath once the overlay hits its own scroll
  // limit, even with overflow set correctly on the overlay itself.
  // Locking body scroll while the drawer's open closes that gap.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={'sidebar-backdrop' + (sidebarOpen ? ' open' : '')} onClick={() => setSidebarOpen(false)} />
      <main className="main">
        <Topbar pageTitle={pageTitle} onMenuClick={() => setSidebarOpen((o) => !o)} />
        <div className="page-content fade-in-up" key={pageTitle}>{children}</div>
      </main>
      <Configurator />
      <ToastContainer />
      <RippleEffect />
    </div>
  )
}