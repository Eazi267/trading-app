import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import Configurator from './Configurator.jsx'
import ToastContainer from './ToastContainer.jsx'

export default function Layout({ pageTitle, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Topbar pageTitle={pageTitle} />
        <div className="page-content">{children}</div>
      </main>
      <Configurator />
      <ToastContainer />
    </div>
  )
}