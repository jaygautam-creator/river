import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUp, Bell, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Compass, Copy, Ellipsis, Headphones, Loader2, LogOut, Menu, Mic, MoreHorizontal, Pencil, Plus, Quote, Search, Send, Settings2, Sparkles, Trash2, X, Zap } from 'lucide-react'
import './styles.css'

const api = async (path, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase()
  const csrf = document.cookie.split('; ').find(value => value.startsWith('river_csrf='))?.split('=')[1]
  const token = localStorage.getItem('kindred_token')
  const response = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-CSRF-Token': csrf } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

const apiAudio = async (path, blob) => {
  const csrf = document.cookie.split('; ').find(value => value.startsWith('river_csrf='))?.split('=')[1]
  const token = localStorage.getItem('kindred_token')
  const response = await fetch(path, { method: 'POST', credentials: 'include', body: blob, headers: { 'Content-Type': blob.type || 'audio/webm', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Voice request failed.')
  return data
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ name, email, password, otp }) })
      localStorage.removeItem('kindred_token'); onAuth(data.user)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <main className="auth-page">
    <div className="auth-glow glow-a" /><div className="auth-glow glow-b" />
    <div className="auth-brand"><div className="brand-mark"><Sparkles size={17} /></div><span>river</span></div>
    <section className="auth-card">
      <div className="auth-intro"><div className="eyebrow"><span className="eyebrow-dot" /> a little more human</div><h1>Keep the thread.</h1><p>A companion that remembers what matters to you — and brings it back at the right moment.</p></div>
      <div className="auth-tabs"><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button></div>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <label>Your name<input value={name} onChange={e => setName(e.target.value)} placeholder="What should I call you?" required /></label>}
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" minLength="6" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required /></label>
        {mode === 'login' && <label>Authenticator code <small className="field-optional">only if you enabled MFA</small><input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>}
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : mode === 'signup' ? 'Begin your thread' : 'Welcome back'}<ArrowUp size={17} /></button>
      </form>
      <div className="auth-note"><BookOpen size={14} /> Your conversations and memories are private to your account.</div>
    </section>
    <div className="auth-footer">Built for the in-between moments <span>·</span> river v0.1</div>
  </main>
}

function Sidebar({ user, threads, activeThreadId, onSelectThread, onNew, onLogout, onSeed, seeding, onPrivacy, onToday, onMemory, onRenameThread, onDeleteThread }) {
  return <aside className="sidebar">
    <div className="sidebar-top"><div className="brand"><div className="brand-mark small"><Sparkles size={14} /></div><span>river</span></div><button className="icon-button subtle" aria-label="More options"><MoreHorizontal size={18} /></button></div>
    <button className="new-thread" onClick={onNew}><Plus size={16} /> New thread <span>⌘ N</span></button>
    <div className="nav-label">Your space</div>
    <nav className="nav-list"><button className="nav-item selected" onClick={onToday}><Compass size={17} /><span>Today</span><span className="nav-count">{threads.length}</span></button><button className="nav-item" onClick={onMemory}><BookOpen size={17} /><span>Memory</span></button></nav>
    <div className="sidebar-thread"><div className="nav-label">Recent</div>{threads.map(thread => <div className={`thread-row ${thread.id === activeThreadId ? 'active' : ''}`} key={thread.id}><button className="thread-select" onClick={() => onSelectThread(thread.id)}><span className="thread-dot" /><span><strong>{thread.title}</strong><small>{new Date(thread.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></span></button><div className="thread-actions"><button aria-label={`Rename ${thread.title}`} onClick={() => onRenameThread(thread)}><Pencil size={12} /></button>{threads.length > 1 && <button aria-label={`Delete ${thread.title}`} onClick={() => onDeleteThread(thread)}><Trash2 size={12} /></button>}</div></div>)}</div>
    <div className="sidebar-bottom">
      <button className="seed-button" onClick={onPrivacy}><Settings2 size={15} /> Privacy controls</button>
      <button className="seed-button" onClick={onSeed} disabled={seeding}><Zap size={15} /> {seeding ? 'Gathering threads…' : 'Seed a richer memory'}</button>
      <div className="account-row"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="account-copy"><strong>{user.name}</strong><small>Personal space</small></div><button className="icon-button subtle" onClick={onLogout}><LogOut size={15} /></button></div>
    </div>
  </aside>
}

function PrivacyPanel({ user, enabled, retentionDays, onToggle, onRetentionChange, onExport, onClose, onAccountDeleted }) {
  const [sessions, setSessions] = useState([])
  const [mfaSetup, setMfaSetup] = useState(null)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const loadSessions = async () => { try { setSessions((await api('/api/auth/sessions')).sessions.filter(session => !session.revoked_at)) } catch {} }
  useEffect(() => { loadSessions() }, [])
  const setupMfa = async () => { setBusy(true); try { setMfaSetup(await api('/api/auth/mfa/setup', { method: 'POST', body: '{}' })); setNotice('Add this secret to an authenticator app, then enter the six-digit code.') } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const enableMfa = async () => { setBusy(true); try { await api('/api/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ otp }) }); setMfaSetup(null); setOtp(''); setNotice('Authenticator protection is now enabled.') } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const revokeSession = async id => { try { await api(`/api/auth/sessions/${id}`, { method: 'DELETE', body: '{}' }); await loadSessions(); setNotice('Session revoked.') } catch (err) { setNotice(err.message) } }
  const deleteAccount = async () => { if (!password || !window.confirm('Permanently delete your River account and all of its data? This cannot be undone.')) return; setBusy(true); try { await api('/api/privacy/account', { method: 'DELETE', body: JSON.stringify({ password }) }); onAccountDeleted() } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const changeRetention = async value => { const days = Number(value); if (days !== retentionDays && days !== -1 && !window.confirm(`River will remove conversation messages older than ${days} days. Approved memories stay under your control. Continue?`)) return; try { const result = await onRetentionChange(days); setNotice(result.deleted_messages ? `${result.deleted_messages} older messages were removed.` : 'Conversation retention updated.') } catch (err) { setNotice(err.message) } }
  return <div className="privacy-overlay"><section className="privacy-card settings-card" role="dialog" aria-modal="true" aria-label="Account and privacy controls"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> your control</div><h2>Account & privacy</h2></div><button className="icon-button" aria-label="Close account controls" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">Your memory, data, and account protections live here.</p><label className="privacy-toggle"><span><strong>Remember what matters</strong><small>Allow River to propose short storyline summaries.</small></span><input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} /></label><section className="settings-section"><strong>Conversation retention</strong><p>Choose how long River keeps your message history. Approved memories are managed separately in the Memory panel.</p><select className="settings-input" value={retentionDays} onChange={e => changeRetention(e.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="-1">Keep until I delete</option></select></section><section className="settings-section"><strong>Two-step sign-in</strong><p>{mfaSetup ? 'Use your authenticator app to scan or enter this secret.' : 'Protect your account with an authenticator app.'}</p>{mfaSetup && <><code className="mfa-secret">{mfaSetup.secret}</code><button className="text-action" onClick={() => navigator.clipboard?.writeText(mfaSetup.secret)}><Copy size={13} /> Copy secret</button><input className="settings-input" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Six-digit code" /><button className="save-button" disabled={busy || otp.length !== 6} onClick={enableMfa}>Enable protection</button></>}{!mfaSetup && !user.mfa_enabled && <button className="ghost-button" disabled={busy} onClick={setupMfa}>Set up authenticator</button>}{user.mfa_enabled && <span className="settings-good"><Check size={14} /> Authenticator protection is enabled</span>}</section><section className="settings-section"><strong>Signed-in devices</strong><p>Revoke a session you do not recognize.</p>{sessions.length === 0 ? <small>No active sessions found.</small> : sessions.map(session => <div className="session-row" key={session.id}><span>{session.user_agent || 'Browser session'}<small>{new Date(session.created_at).toLocaleDateString()}</small></span><button className="text-action danger" onClick={() => revokeSession(session.id)}>Revoke</button></div>)}</section><section className="settings-section"><strong>Your data</strong><p>Download a portable copy, or permanently delete your account.</p><button className="ghost-button" onClick={onExport}>Download my data</button><div className="delete-row"><input className="settings-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirm password to delete" /><button className="text-action danger" disabled={busy} onClick={deleteAccount}>Delete account</button></div></section>{notice && <div className="settings-notice" role="status">{notice}</div>}<div className="privacy-actions"><button className="ghost-button" onClick={onClose}>Done</button></div></section></div>
}

function Message({ message }) {
  const isUser = message.role === 'user'
  return <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}><div className="message-meta">{isUser ? 'You' : <><span className="mini-spark"><Sparkles size={11} /></span> River</>}<span className="message-time">{message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'now'}</span></div><div className="message-body">{message.content}</div></div>
}

function Composer({ onSend, busy, mode, setMode }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [value])
  const send = e => { e?.preventDefault(); if (!busy && value.trim()) { onSend(value.trim()); setValue('') } }
  return <div className="composer-wrap"><div className="mode-switch"><button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}><Send size={14} /> Text</button><button className={mode === 'voice' ? 'active' : ''} onClick={() => setMode('voice')}><Mic size={14} /> Voice</button></div>{mode === 'text' ? <form className="composer" onSubmit={send}><textarea ref={textareaRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }} placeholder="What’s on your mind?" rows="1" aria-label="What’s on your mind?" /><button className="send-button" disabled={!value.trim() || busy} aria-label="Send message">{busy ? <Loader2 className="spin" size={18} /> : <ArrowUp size={18} />}</button></form> : <div className="voice-composer"><div className="voice-orb"><Mic size={21} /></div><div><strong>Voice is ready when you are</strong><span>The same thread, just spoken.</span></div><button className="ghost-button" onClick={() => setMode('text')}>Back to text</button></div>}<div className="composer-hint"><span>River can make mistakes. Your memories are always yours to edit.</span><span className="shortcut"><kbd>↵</kbd> to send</span></div></div>
}

function MemoryPanel({ storylines, proposals = [], onUpdate, onDelete, onApprove, onReject, onHistory, onClose }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({})
  const [historyFor, setHistoryFor] = useState(null)
  const [history, setHistory] = useState([])
  const startEdit = story => { setEditing(story.id); setDraft({ topic: story.topic, summary: story.summary }) }
  const save = async id => { await onUpdate(id, draft); setEditing(null) }
  const showHistory = async id => { if (historyFor === id) { setHistoryFor(null); return } const data = await onHistory(id); setHistory(data.events); setHistoryFor(id) }
  return <aside className="memory-panel" aria-label="Memory panel"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> private memory</div><h2>Storylines</h2></div><button className="icon-button" aria-label="Close memory panel" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">The things you’ve shared that are still in motion. You’re always in control.</p>{proposals.length > 0 && <div className="proposal-list"><div className="eyebrow"><span className="eyebrow-dot" /> review before remembering</div>{proposals.map(p => <article className="proposal-card" key={p.id}><strong>{p.topic}</strong><p>{p.summary}</p><small>{p.sensitivity === 'sensitive' ? 'Sensitive memory · ' : ''}{p.conflict_storyline_id ? 'May revise an existing memory · ' : ''}{Math.round(p.confidence * 100)}% confidence · “{p.source_quote}”</small><div className="edit-actions"><button className="ghost-button" onClick={() => onReject(p.id)}>Not now</button><button className="save-button" onClick={() => onApprove(p.id)}><Check size={14} /> Remember</button></div></article>)}</div>}<div className="memory-stats"><div><strong>{storylines.length}</strong><span>remembered</span></div><div><strong>{storylines.filter(s => s.status === 'open').length}</strong><span>open threads</span></div></div><div className="storyline-list">{storylines.length === 0 ? <div className="empty-memory"><div className="empty-icon"><BookOpen size={20} /></div><strong>Your memory is quiet.</strong><span>As you talk, the things that matter will gather here.</span></div> : storylines.map(s => <article className={`storyline-card ${s.status}`} key={s.id}>{editing === s.id ? <div className="edit-form"><input aria-label="Memory topic" value={draft.topic} onChange={e => setDraft({ ...draft, topic: e.target.value })} /><textarea aria-label="Memory summary" value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /><div className="edit-actions"><button className="ghost-button" onClick={() => setEditing(null)}>Cancel</button><button className="save-button" onClick={() => save(s.id)}><Check size={14} /> Save</button></div></div> : <><div className="storyline-top"><span className={`status-pill ${s.status}`}>{s.status === 'open' ? 'Open' : s.status === 'stale' ? 'Quiet' : 'Resolved'}</span><button className="card-menu" aria-label={`Edit ${s.topic}`} onClick={() => startEdit(s)}><Pencil size={14} /></button></div><h3>{s.topic}</h3><p>{s.summary}</p>{s.source_quotes?.[0] && <div className="quote"><Quote size={13} /><span>{s.source_quotes[0]}</span></div>}<div className="storyline-foot"><span><Clock3 size={12} /> {s.status === 'open' ? 'Follow up soon' : '2 months ago'}</span><div><button className="history-button" onClick={() => showHistory(s.id)}>History</button><button onClick={() => onDelete(s.id)} aria-label="Delete memory"><Trash2 size={13} /></button></div></div>{historyFor === s.id && <div className="memory-history">{history.length ? history.map(event => <span key={`${event.event}-${event.created_at}`}>{event.event.replace('memory.', '').replace('_', ' ')} · {new Date(event.created_at).toLocaleDateString()}</span>) : <span>No recorded changes yet.</span>}</div>}</>}</article>)}</div><div className="panel-footer"><CircleHelp size={14} /><span>River only uses approved summaries — never your raw chat history — to keep the thread.</span></div></aside>
}

function EmptyState({ user, onSeed, onPrompt }) {
  return <div className="empty-state"><div className="hello-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hello-mark"><Sparkles size={24} /></div></div><div className="eyebrow centered"><span className="eyebrow-dot" /> your space, your pace</div><h1>What’s here today,<br /><em>{user.name.split(' ')[0]}?</em></h1><p>Start anywhere. River keeps your conversations private, and only saves a memory when you approve it.</p><ol className="onboarding-steps" aria-label="How River works"><li><strong>Talk in threads</strong><span>Keep different parts of life in their own space.</span></li><li><strong>Review memory</strong><span>River proposes; you decide what it keeps.</span></li><li><strong>Come back anytime</strong><span>Search, edit, export, or delete on your terms.</span></li></ol><div className="prompt-grid"><button onClick={() => onPrompt('I have something on my mind that I want to unpack.')}><span>Unpack something</span><small>that’s been circling</small><ArrowUp size={15} /></button><button onClick={() => onPrompt('Help me make a small plan for today.')}><span>Make a small plan</span><small>one next step at a time</small><ArrowUp size={15} /></button><button className="memory-prompt" onClick={onSeed}><span>Explore memory</span><small>see your approved storylines</small><BookOpen size={15} /></button></div></div>
}

function TodayPanel({ reminders, storylines, onClose, onOpenMemory }) {
  return <div className="privacy-overlay"><section className="privacy-card today-card" role="dialog" aria-modal="true" aria-label="Today in River"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> a gentle check-in</div><h2>Today</h2></div><button className="icon-button" aria-label="Close today" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">A quiet view of the things you may want to return to. Nothing is sent outside River.</p><div className="today-stats"><div><strong>{storylines.filter(storyline => storyline.status === 'open').length}</strong><span>open storylines</span></div><div><strong>{reminders.length}</strong><span>gentle follow-ups</span></div></div><section className="today-reminders"><div className="eyebrow"><Bell size={12} /> follow-ups</div>{reminders.length ? reminders.map(reminder => <article className="reminder-card" key={reminder.id}><strong>{reminder.topic}</strong><p>{reminder.summary}</p><small>Due {new Date(reminder.follow_up_due).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></article>) : <div className="today-empty">No follow-ups are due. You can simply start wherever you are.</div>}</section><div className="privacy-actions"><button className="ghost-button" onClick={onOpenMemory}>Open memory</button><button className="save-button" onClick={onClose}>Done</button></div></section></div>
}

function VoiceScreen({ onBack, onSend }) {
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('Start once. River will listen, answer, and listen again until you end the conversation.')
  const streamRef = useRef(null), audioRef = useRef(null), recorderRef = useRef(null), audioUrlRef = useRef(null)
  const contextRef = useRef(null), analyserRef = useRef(null), monitorRef = useRef(null), conversationRef = useRef(false)
  const stateRef = useRef('idle'), heardSpeechRef = useRef(false), lastSpeechRef = useRef(0), speechOnsetRef = useRef(0), turnStartedRef = useRef(0)
  const setVoiceState = value => { stateRef.current = value; setState(value) }
  const clearMonitor = () => { if (monitorRef.current) window.clearInterval(monitorRef.current); monitorRef.current = null }
  const stop = () => {
    conversationRef.current = false; clearMonitor()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null
    contextRef.current?.close().catch(() => {}); contextRef.current = null; analyserRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute('src') }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null
    setVoiceState('idle'); setMessage('Voice conversation ended. River does not store your audio recording.')
  }
  useEffect(() => () => stop(), [])
  const volume = () => {
    if (!analyserRef.current) return 0
    const values = new Uint8Array(analyserRef.current.fftSize); analyserRef.current.getByteTimeDomainData(values)
    return values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length
  }
  const playCurrentReply = async () => {
    if (!audioRef.current?.src) throw new Error('River’s audio reply is no longer available. Please speak again.')
    audioRef.current.onended = () => { if (conversationRef.current) beginListening() }
    audioRef.current.onerror = () => { setVoiceState('awaiting-playback'); setMessage('River created a reply, but your browser could not play it. Check tab sound, then try again or continue by text.') }
    await audioRef.current.play()
    setVoiceState('speaking'); setMessage('River is speaking — begin talking at any time to interrupt.')
  }
  const beginListening = () => {
    if (!conversationRef.current || !streamRef.current || recorderRef.current?.state === 'recording') return
    const chunks = []; const recorder = new MediaRecorder(streamRef.current); recorderRef.current = recorder
    heardSpeechRef.current = false; lastSpeechRef.current = Date.now(); speechOnsetRef.current = 0; turnStartedRef.current = Date.now()
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => { setVoiceState('error'); setMessage('Your microphone recording stopped unexpectedly. Try reconnecting voice.') }
    recorder.onstop = async () => {
      if (!conversationRef.current || !heardSpeechRef.current) return
      try {
        setVoiceState('thinking'); setMessage('River is thinking…')
        const { transcript } = await apiAudio('/api/voice/transcribe', new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        const reply = await onSend(transcript)
        if (!reply) throw new Error('River could not create a reply.')
        setVoiceState('speaking'); setMessage('River is speaking — begin talking at any time to interrupt.')
        const csrf = document.cookie.split('; ').find(value => value.startsWith('river_csrf='))?.split('=')[1]
        const speech = await fetch('/api/voice/speak', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: JSON.stringify({ text: reply }) })
        if (!speech.ok) { const data = await speech.json().catch(() => ({})); throw new Error(data.error || 'River could not create spoken audio.') }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = URL.createObjectURL(await speech.blob())
        if (audioRef.current) {
          audioRef.current.src = audioUrlRef.current
          try { await playCurrentReply() } catch { setVoiceState('awaiting-playback'); setMessage('Your browser paused River’s audio. Tap “Play River’s reply” to hear it and continue.') }
        }
      } catch (error) { setVoiceState('error'); setMessage(error.message || 'Voice could not complete. Try again.') }
    }
    recorder.start(250); setVoiceState('listening'); setMessage('Listening… pause naturally when you are done.')
  }
  const begin = async () => {
    setVoiceState('connecting'); setMessage('Checking your microphone permission…')
    try {
      const session = await api('/api/voice/session')
      if (!session.enabled || session.provider !== 'groq') throw new Error('Groq voice is not configured for this River environment yet.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); streamRef.current = stream
      const AudioContextClass = window.AudioContext || window.webkitAudioContext; const context = new AudioContextClass(); contextRef.current = context
      if (context.state === 'suspended') await context.resume()
      const analyser = context.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.75; analyserRef.current = analyser; context.createMediaStreamSource(stream).connect(analyser)
      conversationRef.current = true
      monitorRef.current = window.setInterval(() => {
        if (!conversationRef.current) return
        const currentVolume = volume(); const now = Date.now(); const voiceDetected = currentVolume > 5.5
        if (voiceDetected) {
          if (!speechOnsetRef.current) speechOnsetRef.current = now
          if (now - speechOnsetRef.current >= 280) { heardSpeechRef.current = true; lastSpeechRef.current = now }
        } else speechOnsetRef.current = 0
        const strongInterruption = currentVolume > 8 && speechOnsetRef.current && now - speechOnsetRef.current >= 450
        if (stateRef.current === 'speaking' && strongInterruption) { audioRef.current?.pause(); audioRef.current?.removeAttribute('src'); beginListening(); return }
        if (stateRef.current === 'listening' && heardSpeechRef.current && now - turnStartedRef.current >= 900 && now - lastSpeechRef.current > 1450) recorderRef.current?.stop()
      }, 120)
      beginListening()
    } catch (error) { setVoiceState('error'); setMessage(error.message || 'Voice setup could not start. Check your microphone and try again.') }
  }
  const replay = async () => { try { await playCurrentReply() } catch { setMessage('Audio is still blocked. Check this tab’s sound/autoplay permission, then try again.') } }
  return <div className="voice-screen"><button className="back-link" onClick={() => { stop(); onBack() }}>← back to text</button><div className="voice-screen-inner"><audio ref={audioRef} /><div className={`voice-breathe ${state === 'listening' ? 'recording' : ''}`}><div className="breathe-ring ring-a" /><div className="breathe-ring ring-b" /><div className="voice-center"><Mic size={30} /></div></div><div className="eyebrow centered"><span className="eyebrow-dot" /> hands-free voice mode</div><h2>Talk naturally.</h2><p>River waits for a real pause, answers, then listens again. Speak clearly to interrupt.</p><div className="voice-note"><Headphones size={16} /><span>{message}</span></div>{state === 'idle' || state === 'error' ? <button className="ghost-button voice-start" onClick={begin} disabled={state === 'connecting'}>{state === 'connecting' ? <Loader2 className="spin" size={14} /> : <Mic size={14} />} {state === 'error' ? 'Try again' : 'Start conversation'}</button> : <div className="voice-actions">{state === 'awaiting-playback' && <button className="save-button voice-start" onClick={replay}><Headphones size={14} /> Play River’s reply</button>}<button className="ghost-button voice-start" onClick={stop}><X size={14} /> End conversation</button></div>}</div></div>
}

function SearchPanel({ onClose, onSelectThread }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ messages: [], storylines: [] })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (query.trim().length < 2) { setResults({ messages: [], storylines: [] }); return }
    const timeout = setTimeout(async () => {
      setBusy(true)
      try { setResults(await api(`/api/search?q=${encodeURIComponent(query.trim())}`)) } catch { setResults({ messages: [], storylines: [] }) } finally { setBusy(false) }
    }, 220)
    return () => clearTimeout(timeout)
  }, [query])
  return <div className="privacy-overlay search-overlay"><section className="privacy-card search-card" role="dialog" aria-modal="true" aria-label="Search conversations and memories"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> find a thread</div><h2>Search River</h2></div><button className="icon-button" aria-label="Close search" onClick={onClose}><X size={18} /></button></div><input className="search-input" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations and memories" />{busy && <div className="search-status"><Loader2 className="spin" size={15} /> Searching…</div>}{!busy && query.length >= 2 && results.messages.length + results.storylines.length === 0 && <div className="search-status">No matches yet.</div>}{results.messages.length > 0 && <div className="search-section"><strong>Conversations</strong>{results.messages.map(result => <button className="search-result" key={`m-${result.id}`} onClick={() => { onSelectThread(result.thread_id); onClose() }}><span>{result.role === 'user' ? 'You' : 'River'}</span><p>{result.content}</p></button>)}</div>}{results.storylines.length > 0 && <div className="search-section"><strong>Approved memories</strong>{results.storylines.map(result => <article className="search-result" key={`s-${result.id}`}><span>{result.topic}</span><p>{result.summary}</p></article>)}</div>}</section></div>
}

function MobileMenuPanel({ onClose, onNew, onToday, onMemory, onPrivacy, onLogout }) {
  const choose = action => { action(); onClose() }
  return <div className="privacy-overlay mobile-nav-overlay"><section className="privacy-card mobile-nav-card" role="dialog" aria-modal="true" aria-label="River navigation"><div className="panel-head"><div className="mobile-brand"><div className="brand-mark small"><Sparkles size={14} /></div>River</div><button className="icon-button" aria-label="Close menu" onClick={onClose}><X size={18} /></button></div><nav className="mobile-nav-list"><button onClick={() => choose(onNew)}><Plus size={17} /> New thread</button><button onClick={() => choose(onToday)}><Compass size={17} /> Today</button><button onClick={() => choose(onMemory)}><BookOpen size={17} /> Memory</button><button onClick={() => choose(onPrivacy)}><Settings2 size={17} /> Account & privacy</button></nav><button className="mobile-logout" onClick={() => choose(onLogout)}><LogOut size={16} /> Sign out</button></section></div>
}

function App({ user, onLogout }) {
  const [messages, setMessages] = useState([])
  const [storylines, setStorylines] = useState([])
  const [proposals, setProposals] = useState([])
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [memoryOpen, setMemoryOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [mode, setMode] = useState('text')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [retentionDays, setRetentionDays] = useState(365)
  const [reminders, setReminders] = useState([])
  const [todayOpen, setTodayOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [error, setError] = useState('')
  const chatRef = useRef(null)
  const loadThread = async id => {
    const data = await api(`/api/conversation?thread_id=${id}`)
    setActiveThreadId(id); setMessages(data.messages); setStorylines(data.storylines); setProposals(data.proposals || []); setError('')
  }
  const refreshThreads = async () => {
    const data = await api('/api/threads'); setThreads(data.threads); return data.threads
  }
  const refreshReminders = async () => {
    const data = await api('/api/reminders'); setReminders(data.reminders); return data.reminders
  }
  useEffect(() => {
    const boot = async () => {
      try { const [available] = await Promise.all([refreshThreads(), refreshReminders(), api('/api/privacy/preferences').then(data => { setMemoryEnabled(data.memory_enabled); setRetentionDays(data.retention_days) })]); if (available[0]) await loadThread(available[0].id) } catch (err) { setError(err.message) }
    }
    boot()
  }, [])
  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return
    const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 180
    if (nearBottom || messages.length <= 2) chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])
  const send = async content => { let threadId = activeThreadId; setBusy(true); setError(''); try { if (!threadId) { const created = await api('/api/threads', { method: 'POST', body: JSON.stringify({ title: 'Today' }) }); threadId = created.thread.id; setThreads(current => [created.thread, ...current]); setActiveThreadId(threadId) } const temp = { id: `temp-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }; setMessages(m => [...m, temp]); const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ content, thread_id: threadId }) }); setMessages(m => [...m.filter(x => x.id !== temp.id), temp, { id: `reply-${Date.now()}`, role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]); setStorylines(data.storylines); setProposals(data.proposals || []); await refreshThreads(); return data.reply } catch (err) { setMessages(m => m.filter(x => !String(x.id).startsWith('temp-'))); setError(err.message); return null } finally { setBusy(false) } }
  const seed = async () => { setSeeding(true); try { const data = await api('/api/storylines/seed', { method: 'POST' }); setStorylines(data.storylines); setMemoryOpen(true) } finally { setSeeding(false) } }
  const update = async (id, draft) => { const data = await api(`/api/storylines/${id}`, { method: 'PUT', body: JSON.stringify(draft) }); setStorylines(s => s.map(x => x.id === id ? data.storyline : x)); await refreshReminders() }
  const remove = async id => { await api(`/api/storylines/${id}`, { method: 'DELETE' }); setStorylines(s => s.filter(x => x.id !== id)); await refreshReminders() }
  const approveProposal = async id => { const data = await api(`/api/memory/proposals/${id}/approve`, { method: 'POST' }); setStorylines(data.storylines); setProposals(data.proposals); await refreshReminders() }
  const rejectProposal = async id => { const data = await api(`/api/memory/proposals/${id}/reject`, { method: 'POST' }); setProposals(data.proposals) }
  const memoryHistory = id => api(`/api/storylines/${id}/history`)
  const savePreferences = async changes => { const data = await api('/api/privacy/preferences', { method: 'PUT', body: JSON.stringify({ memory_enabled: memoryEnabled, retention_days: retentionDays, ...changes }) }); setMemoryEnabled(data.memory_enabled); setRetentionDays(data.retention_days); return data }
  const toggleMemory = async enabled => { await savePreferences({ memory_enabled: enabled }); if (!enabled) setStorylines([]) }
  const changeRetention = days => savePreferences({ retention_days: days })
  const exportData = async () => { try { const data = await api('/api/privacy/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `river-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url) } catch (err) { setError(err.message) } }
  const newThread = async () => { try { const data = await api('/api/threads', { method: 'POST', body: JSON.stringify({ title: 'New thread' }) }); setThreads(current => [data.thread, ...current]); setActiveThreadId(data.thread.id); setMessages([]); setProposals([]); setMode('text'); setMemoryOpen(false); setError(''); requestAnimationFrame(() => document.querySelector('.composer textarea')?.focus()) } catch (err) { setError(err.message) } }
  const renameThread = async thread => { const title = window.prompt('Name this conversation', thread.title)?.trim(); if (!title || title === thread.title) return; try { await api(`/api/threads/${thread.id}`, { method: 'PATCH', body: JSON.stringify({ title }) }); await refreshThreads() } catch (err) { setError(err.message) } }
  const deleteThread = async thread => { if (!window.confirm(`Delete “${thread.title}”? This only deletes this conversation.`)) return; try { await api(`/api/threads/${thread.id}`, { method: 'DELETE', body: '{}' }); const available = await refreshThreads(); if (thread.id === activeThreadId && available[0]) await loadThread(available[0].id) } catch (err) { setError(err.message) } }
  const hasMessages = messages.length > 0
  return <><div className="app-shell"><Sidebar user={user} threads={threads} activeThreadId={activeThreadId} onSelectThread={loadThread} onLogout={onLogout} onNew={newThread} onSeed={seed} seeding={seeding} onPrivacy={() => setPrivacyOpen(true)} onToday={() => setTodayOpen(true)} onMemory={() => setMemoryOpen(true)} onRenameThread={renameThread} onDeleteThread={deleteThread} /><main className="main-column"><header className="topbar"><div className="mobile-brand"><div className="brand-mark small"><Sparkles size={14} /></div>River</div><div className="session-label"><span className="live-dot" /> ongoing thread <ChevronDown size={14} /></div><div className="top-actions"><button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={17} /></button><button className={`memory-toggle ${memoryOpen ? 'active' : ''}`} onClick={() => setMemoryOpen(!memoryOpen)} aria-expanded={memoryOpen}><BookOpen size={15} /> <span>Memory</span><span className="memory-number">{storylines.length + proposals.length}</span></button><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={18} /></button></div></header>{mode === 'voice' ? <VoiceScreen onBack={() => setMode('text')} onSend={send} /> : <><section ref={chatRef} className={`chat-area ${hasMessages ? 'has-messages' : ''}`}>{hasMessages ? <div className="message-list">{messages.map(m => <Message key={m.id} message={m} />)}{busy && <div className="thinking"><span className="mini-spark"><Sparkles size={11} /></span><span className="thinking-label">River is thinking</span><i /><i /><i /></div>}</div> : <EmptyState user={user} onSeed={seed} onPrompt={send} />}</section>{error && <div className="connection-notice" role="status">{error}</div>}<Composer onSend={send} busy={busy} mode={mode} setMode={setMode} /></>}</main>{memoryOpen && <><button className="memory-backdrop" aria-label="Dismiss memory overlay" onClick={() => setMemoryOpen(false)} /><MemoryPanel storylines={storylines} proposals={proposals} onUpdate={update} onDelete={remove} onApprove={approveProposal} onReject={rejectProposal} onHistory={memoryHistory} onClose={() => setMemoryOpen(false)} /></>}</div>{mobileNavOpen && <MobileMenuPanel onClose={() => setMobileNavOpen(false)} onNew={newThread} onToday={() => setTodayOpen(true)} onMemory={() => setMemoryOpen(true)} onPrivacy={() => setPrivacyOpen(true)} onLogout={onLogout} />}{todayOpen && <TodayPanel reminders={reminders} storylines={storylines} onClose={() => setTodayOpen(false)} onOpenMemory={() => { setTodayOpen(false); setMemoryOpen(true) }} />}{privacyOpen && <PrivacyPanel user={user} enabled={memoryEnabled} retentionDays={retentionDays} onToggle={toggleMemory} onRetentionChange={changeRetention} onExport={exportData} onClose={() => setPrivacyOpen(false)} onAccountDeleted={onLogout} />}{searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} onSelectThread={loadThread} />}</>
}

function Root() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => { api('/api/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('kindred_token')).finally(() => setChecking(false)) }, [])
  const logout = async () => { try { await api('/api/auth/logout', { method: 'POST', body: '{}' }) } catch {} finally { localStorage.removeItem('kindred_token'); setUser(null) } }
  if (checking) return <div className="loading-screen"><div className="brand-mark"><Sparkles size={18} /></div><Loader2 className="spin" size={18} /></div>
  return user ? <App user={user} onLogout={logout} /> : <Auth onAuth={setUser} />
}

createRoot(document.getElementById('root')).render(<Root />)
