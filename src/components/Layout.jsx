import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import Configurator from './Configurator.jsx'
import ToastContainer from './ToastContainer.jsx'
import RippleEffect from './RippleEffect.jsx'

export default function Layout({ pageTitle, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Topbar pageTitle={pageTitle} />
        <div className="page-content fade-in-up" key={pageTitle}>{children}</div>
      </main>
      <Configurator />
      <ToastContainer />
      <RippleEffect />
    </div>
  )
}