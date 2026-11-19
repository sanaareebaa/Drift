import { useCallback, useEffect, useRef, useState } from 'react'
import { getIdeas, updateIdea } from '../services/ideaStore'

const CHECK_EVERY_MS = 60_000

// In-app reminders cover the "notification" channel (and older ideas saved before channels existed).
// Email reminders are handled by the send-reminders function, so they are skipped here.
const isInApp = (i) => i.reminderAt && !i.reminderSent && (!i.reminderChannel || i.reminderChannel === 'notification')

export function useDueReminders() {
  const [due, setDue] = useState([])
  const [upcoming, setUpcoming] = useState(0)
  const dismissed = useRef(new Set())

  const check = useCallback(async () => {
    try {
      const ideas = await getIdeas()
      const pending = ideas.filter(isInApp).filter((i) => !dismissed.current.has(i.id))
      const now = Date.now()
      const time = (i) => new Date(i.reminderAt).getTime()
      setDue(pending.filter((i) => time(i) <= now).sort((a, b) => time(a) - time(b)))
      setUpcoming(pending.filter((i) => time(i) > now).length)
    } catch {
      // Stay quiet and try again on the next check
    }
  }, [])

  useEffect(() => {
    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [check])

  // Dismissing marks the reminder as sent so it never comes back
  const dismiss = useCallback(async (id) => {
    dismissed.current.add(id)
    setDue((list) => list.filter((i) => i.id !== id))
    try {
      await updateIdea(id, { reminderSent: true })
    } catch {
      dismissed.current.delete(id)
      check()
    }
  }, [check])

  return { due, upcoming, dismiss }
}