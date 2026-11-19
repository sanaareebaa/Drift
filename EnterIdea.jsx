import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { addIdea } from '../../services/ideaStore'
import { uploadImages } from '../../services/storage'
import './EnterIdea.css'

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function EnterIdea() {
  const navigate = useNavigate()

  const [text, setText] = useState('')
  const [transcript, setTranscript] = useState('') // what was dictated, kept as audioTranscript
  const [images, setImages] = useState([]) // [{ file, url }]
  const [reminderAt, setReminderAt] = useState('')
  const [channel, setChannel] = useState('notification')
  const [listening, setListening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const recognitionRef = useRef(null)
  const baseTextRef = useRef('')
  const imagesRef = useRef(images)
  imagesRef.current = images

  // cleanup: stop mic and free thumbnail URLs on leave
  useEffect(() => () => {
    recognitionRef.current?.stop()
    imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
  }, [])

  // ---------- B3: voice ----------
  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    baseTextRef.current = text
    let spoken = ''

    rec.onresult = (e) => {
      let finalPart = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) finalPart += chunk
        else interim += chunk
      }
      spoken = (finalPart + interim).trim()
      const base = baseTextRef.current
      setText(base ? `${base} ${spoken}` : spoken)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone access was blocked.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Voice input failed. Try again.')
    }
    rec.onend = () => {
      setListening(false)
      if (spoken) setTranscript((t) => (t ? `${t} ${spoken}` : spoken))
    }

    setError('')
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  // ---------- B2: images ----------
  function addImages(e) {
    const picked = Array.from(e.target.files || [])
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...picked])
    e.target.value = '' // allow re-picking the same file
  }

  function removeImage(url) {
    URL.revokeObjectURL(url)
    setImages((prev) => prev.filter((i) => i.url !== url))
  }

  // ---------- B1 + B4 + B5: save ----------
  async function handleSave() {
    setError('')
    setSuccess(false)

    if (!text.trim()) {
      setError('Write or record something before saving.')
      return
    }
    if (reminderAt && new Date(reminderAt) <= new Date()) {
      setError('Pick a reminder time in the future.')
      return
    }

    recognitionRef.current?.stop()
    setSaving(true)
    try {
      const imagePaths = images.length ? await uploadImages(images.map((i) => i.file)) : []
      await addIdea({
        text: text.trim(),
        audioTranscript: transcript || null,
        imagePaths,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        reminderChannel: reminderAt ? channel : null,
      })
      images.forEach((i) => URL.revokeObjectURL(i.url))
      setText('')
      setTranscript('')
      setImages([])
      setReminderAt('')
      setChannel('notification')
      setSuccess(true)
    } catch (err) {
  console.error('Save failed:', err)
  setError("Couldn't save your idea. Check your connection and try again.")
} finally {
      setSaving(false)
    }
  }

  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  return (
    <main className="page enter">
      <header className="enter-header">
        <button className="enter-back" onClick={() => navigate('/home')} aria-label="Back to home">←</button>
        <h1 className="enter-title">New idea</h1>
      </header>

      <section className="enter-body">
        <textarea
          className="enter-text"
          placeholder="What's the idea?"
          value={text}
          onChange={(e) => { setText(e.target.value); setSuccess(false) }}
          rows={7}
          disabled={saving}
        />

        <div className="enter-tools">
          {SpeechRecognition ? (
            <Button
              variant="outline"
              onClick={toggleVoice}
              disabled={saving}
              aria-pressed={listening}
            >
              {listening ? '■ Stop recording' : '🎤 Record voice'}
            </Button>
          ) : (
            <p className="enter-hint">Voice input isn’t supported in this browser. It works best in Chrome.</p>
          )}

          <label className="enter-file">
            <input type="file" accept="image/*" multiple onChange={addImages} disabled={saving} />
            + Add images
          </label>
        </div>

        {listening && <p className="enter-hint enter-live">Listening…</p>}

        {images.length > 0 && (
          <ul className="enter-thumbs">
            {images.map(({ url, file }) => (
              <li key={url} className="enter-thumb">
                <img src={url} alt={file.name} />
                <button onClick={() => removeImage(url)} aria-label={`Remove ${file.name}`} disabled={saving}>×</button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="enter-reminder">
          <legend>Reminder (optional)</legend>
          <input
            type="datetime-local"
            value={reminderAt}
            min={minDateTime}
            onChange={(e) => setReminderAt(e.target.value)}
            disabled={saving}
          />
          {reminderAt && (
            <div className="enter-channel" role="radiogroup" aria-label="Reminder channel">
              {['notification', 'email'].map((c) => (
                <label key={c}>
                  <input
                    type="radio"
                    name="channel"
                    value={c}
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                  />
                  {c === 'notification' ? 'Notification' : 'Email'}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error && <p className="enter-msg enter-error" role="alert">{error}</p>}
        {success && (
          <p className="enter-msg enter-success" role="status">
            Idea saved. <button className="enter-link" onClick={() => navigate('/workspace')}>View ideas</button>
          </p>
        )}
      </section>

      <footer className="enter-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save idea'}</Button>
      </footer>
    </main>
  )
}