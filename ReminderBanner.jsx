import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDueReminders } from '../hooks/useDueReminders'
import './ReminderBanner.css'

// Module-level so they survive page changes (the banner remounts on each route)
const notified = new Set()
let hintDismissed = false

const MAX_SHOWN = 3
const supported = typeof window !== 'undefined' && 'Notification' in window
const when = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function ReminderBanner() {
  const navigate = useNavigate()
  const { due, upcoming, dismiss } = useDueReminders()
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')
  const [hintHidden, setHintHidden] = useState(hintDismissed)

  // Browser notification, once per reminder (works while Drift is open in any tab)
  useEffect(() => {
    if (permission !== 'granted') return
    due.forEach((i) => {
      if (notified.has(i.id)) return
      notified.add(i.id)
      try { new Notification('Drift reminder', { body: i.title || i.text }) } catch { /* ignore */ }
    })
  }, [due, permission])

  const enableNotifications = async () => {
    try { setPermission(await Notification.requestPermission()) } catch { setPermission('denied') }
  }
  const hideHint = () => { hintDismissed = true; setHintHidden(true) }
  const open = async (id) => { await dismiss(id); navigate(`/workspace/${id}`) }

  const showHint = permission === 'default' && upcoming + due.length > 0 && !hintHidden
  if (!due.length && !showHint) return null

  return (
    <div className="reminder-stack" aria-live="polite">
      {due.slice(0, MAX_SHOWN).map((i) => (
        <div className="reminder-card" key={i.id} role="status">
          <div className="reminder-text">
            <strong>Reminder</strong>
            <span>{i.title || i.text}</span>
            <small>Due {when(i.reminderAt)}</small>
          </div>
          <div className="reminder-actions">
            <button onClick={() => open(i.id)}>Open</button>
            <button className="quiet" onClick={() => dismiss(i.id)} aria-label="Dismiss reminder">Dismiss</button>
          </div>
        </div>
      ))}
      {due.length > MAX_SHOWN && <div className="reminder-more">+{due.length - MAX_SHOWN} more reminders</div>}

      {showHint && (
        <div className="reminder-card hint">
          <div className="reminder-text"><span>Get a pop-up when a reminder is due, even from another tab.</span></div>
          <div className="reminder-actions">
            <button onClick={enableNotifications}>Allow</button>
            <button className="quiet" onClick={hideHint}>Not now</button>
          </div>
        </div>
      )}
    </div>
  )
}