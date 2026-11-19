import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AppShell.css'

// Shared layout for every signed-in page: a sidebar on the left, the page on the right.
// Pages never import this; ProtectedRoute wraps them in it.

const ICONS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  list: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  active: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></>,
  done: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>,
  dead: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  out: <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
}
const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
)

const MAIN = [
  { to: '/home', label: 'Dashboard', icon: 'home' },
  { to: '/enter', label: 'Enter idea', icon: 'plus' },
  { to: '/workspace', label: 'View ideas', icon: 'list' },
]
const FILTERS = [
  { key: 'active', label: 'Active ideas', icon: 'active' },
  { key: 'completed', label: 'Completed ideas', icon: 'done' },
  { key: 'dead', label: 'Dead ideas', icon: 'dead' },
]

export default function AppShell({ children }) {
  const { pathname, search } = useLocation()
  const { user, signOut, isMock } = useAuth()
  const filter = new URLSearchParams(search).get('filter')

  const isOn = (to) => {
    if (to === '/workspace') return pathname.startsWith('/workspace') && !filter
    return pathname === to
  }
  const link = (to, label, icon, on) => (
    <Link key={to + label} to={to} className={`shell-link ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  )

  const name = user?.firstName || 'friend'

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <Link to="/home" className="brand">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" opacity=".9" />
            <path d="M5 19c3-5 6-8 10-10" fill="none" stroke="#FAFAF5" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>Drift</span>
        </Link>

        <nav className="shell-nav" aria-label="Pages">
          {MAIN.map((m) => link(m.to, m.label, m.icon, isOn(m.to)))}
        </nav>
        <nav className="shell-nav" aria-label="Filter ideas">
          {FILTERS.map((f) => link(`/workspace?filter=${f.key}`, f.label, f.icon, pathname === '/workspace' && filter === f.key))}
        </nav>

        <div className="sidebar-foot">
          <span className="avatar" aria-hidden="true">{name[0]?.toUpperCase()}</span>
          <span className="sidebar-name">{name}</span>
          {!isMock && (
            <button className="shell-signout" onClick={signOut} aria-label="Sign out"><Icon name="out" /></button>
          )}
        </div>
      </aside>

      <div className="shell-main">{children}</div>

    </div>
  )
}