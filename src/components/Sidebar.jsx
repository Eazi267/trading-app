import { NavLink } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext.jsx'
import { useNavModel } from './navModel.jsx'

// Desktop: a slim icon rail that stays put while the page scrolls and
// widens on hover/focus to show labels. Phone: the same markup is the
// slide-in drawer opened by the dock's "More" button.
export default function Sidebar({ open, onClose }) {
  const { brand } = useSettings()
  const { sections } = useNavModel()

  return (
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <div className="brand">
        <div className="brand-mark"><brand.LogoIcon size={18} /></div>
        <span className="brand-name">{brand.name}</span>
      </div>
      <nav>
        {sections.map((section, i) => (
          <div key={section.label || i} className="nav-section">
            {section.label && <div className="nav-section-label">{section.label}</div>}
            {section.links.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={to} to={to} end={end} onClick={onClose} title={label} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <Icon size={16} /> <span className="nav-label">{label}</span>
                {!!badge && <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
