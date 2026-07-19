import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUp, Bell, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Compass, Copy, Ellipsis, Headphones, Loader2, LogOut, Menu, Mic, MoreHorizontal, Pencil, Plus, Quote, Search, Send, Settings2, Sparkles, Trash2, X, Zap } from 'lucide-react'
import './styles.css'

const api = async (path, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase()
  const csrf = document.cookie.split('; ').find(value => value.startsWith('river_csrf='))?.split('=')[1]
  const response = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-CSRF-Token': csrf } : {}), ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

const apiAudio = async (path, blob) => {
  const csrf = document.cookie.split('; ').find(value => value.startsWith('river_csrf='))?.split('=')[1]
  const response = await fetch(path, { method: 'POST', credentials: 'include', body: blob, headers: { 'Content-Type': blob.type || 'audio/webm', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Voice request failed.')
  return data
}

const useEscapeDismiss = onDismiss => {
  useEffect(() => {
    const dismiss = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onDismiss()
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [onDismiss])
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).has('reset_token') ? 'reset' : 'signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('verify_email_token')
    if (!token) return
    api('/api/auth/email-verification/complete', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => { window.history.replaceState({}, '', window.location.pathname); setMode('login'); setNotice('Your email is verified. You can sign in now.') })
      .catch(err => setError(err.message))
  }, [])
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'recovery') { const data = await api('/api/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }); setNotice(data.message); return }
      if (mode === 'reset') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        const token = new URLSearchParams(window.location.search).get('reset_token')
        await api('/api/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password }) })
        window.history.replaceState({}, '', window.location.pathname); setMode('login'); setPassword(''); setConfirmPassword(''); setNotice('Your password was reset. You can sign in now.'); return
      }
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ name, email, password, otp }) })
      onAuth(data.user)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <main className="auth-page">
    <div className="auth-glow glow-a" /><div className="auth-glow glow-b" />
    <div className="auth-brand"><div className="brand-mark"><Sparkles size={17} /></div><span>river</span></div>
    <section className="auth-card">
      <div className="auth-intro"><div className="eyebrow"><span className="eyebrow-dot" /> a little more human</div><h1>Keep the thread.</h1><p>A companion that remembers what matters to you — and brings it back at the right moment.</p></div>
      {mode !== 'recovery' && mode !== 'reset' && <div className="auth-tabs"><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setNotice('') }}>Create account</button><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setNotice('') }}>Sign in</button></div>}
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <label>Your name<input value={name} onChange={e => setName(e.target.value)} placeholder="What should I call you?" required /></label>}
        {mode !== 'reset' && <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>}
        {mode !== 'recovery' && <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" minLength={mode === 'reset' ? 12 : 6} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'reset' ? 'At least 12 characters' : 'At least 6 characters'} required /></label>}
        {mode === 'reset' && <label>Confirm new password<input type="password" minLength="12" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your new password" required /></label>}
        {mode === 'login' && <label>Authenticator code <small className="field-optional">only if you enabled MFA</small><input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>}
        {error && <div className="form-error">{error}</div>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : mode === 'signup' ? 'Begin your thread' : mode === 'login' ? 'Welcome back' : mode === 'recovery' ? 'Send recovery instructions' : 'Save new password'}<ArrowUp size={17} /></button>
      </form>
      {mode === 'login' && <button className="auth-link" onClick={() => { setMode('recovery'); setError(''); setNotice('') }}>Forgot your password?</button>}
      {(mode === 'recovery' || mode === 'reset') && <button className="auth-link" onClick={() => { window.history.replaceState({}, '', window.location.pathname); setMode('login'); setError(''); setNotice('') }}>Back to sign in</button>}
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
      <button className="seed-button" onClick={onSeed} disabled={seeding}><Zap size={15} /> {seeding ? 'Opening memory…' : 'Review your memory'}</button>
      <div className="account-row"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="account-copy"><strong>{user.name}</strong><small>Personal space</small></div><button className="icon-button subtle" onClick={onLogout}><LogOut size={15} /></button></div>
    </div>
  </aside>
}

function PrivacyPanel({ user, enabled, memoryMode, retentionDays, onToggle, onMemoryModeChange, onRetentionChange, onExport, onClose, onAccountDeleted }) {
  const [sessions, setSessions] = useState([])
  const [securityEvents, setSecurityEvents] = useState([])
  const [passkeyStatus, setPasskeyStatus] = useState(null)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEscapeDismiss(onClose)
  const loadSecurity = async () => { try { const [sessionData, eventData, passkeyData] = await Promise.all([api('/api/auth/sessions'), api('/api/auth/security-events'), api('/api/auth/passkeys/status')]); setSessions(sessionData.sessions.filter(session => !session.revoked_at)); setSecurityEvents(eventData.events || []); setPasskeyStatus(passkeyData) } catch {} }
  useEffect(() => { loadSecurity() }, [])
  const setupMfa = async () => { setBusy(true); try { setMfaSetup(await api('/api/auth/mfa/setup', { method: 'POST', body: '{}' })); setNotice('Add this secret to an authenticator app, then enter the six-digit code.') } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const enableMfa = async () => { setBusy(true); try { await api('/api/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ otp }) }); setMfaSetup(null); setOtp(''); setNotice('Authenticator protection is now enabled.') } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const revokeSession = async id => { try { await api(`/api/auth/sessions/${id}`, { method: 'DELETE', body: '{}' }); await loadSecurity(); setNotice('Session revoked.') } catch (err) { setNotice(err.message) } }
  const revokeAllSessions = async () => { if (!window.confirm('Sign out every device, including this one? You will need to sign in again.')) return; setBusy(true); try { await api('/api/auth/sessions/revoke-all', { method: 'POST', body: '{}' }); onAccountDeleted() } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const deleteAccount = async () => { if (!password || !window.confirm('Permanently delete your River account and all of its data? This cannot be undone.')) return; setBusy(true); try { await api('/api/privacy/account', { method: 'DELETE', body: JSON.stringify({ password }) }); onAccountDeleted() } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const resendVerification = async () => { setBusy(true); try { const result = await api('/api/auth/email-verification/request', { method: 'POST', body: '{}' }); setNotice(result.message) } catch (err) { setNotice(err.message) } finally { setBusy(false) } }
  const changeRetention = async value => { const days = Number(value); if (days !== retentionDays && days !== -1 && !window.confirm(`River will remove conversation messages older than ${days} days. Approved memories stay under your control. Continue?`)) return; try { const result = await onRetentionChange(days); setNotice(result.deleted_messages ? `${result.deleted_messages} older messages were removed.` : 'Conversation retention updated.') } catch (err) { setNotice(err.message) } }
  const changeMemoryMode = async value => { try { await onMemoryModeChange(value); setNotice(value === 'review' ? 'River will ask before saving every memory.' : 'River will automatically save clear, everyday details and ask before sensitive memories.') } catch (err) { setNotice(err.message) } }
  return <div className="privacy-overlay"><section className="privacy-card settings-card" role="dialog" aria-modal="true" aria-label="Account and privacy controls"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> your control</div><h2>Account & privacy</h2></div><button className="icon-button" aria-label="Close account controls" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">You decide what River may remember, how it is saved, and how long your data stays.</p><label className="privacy-toggle"><span><strong>Remember what matters</strong><small>Turn this off at any time to stop new memory proposals and saved details.</small></span><input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} /></label><section className="settings-section"><strong>Email verification</strong><p>{user.email_verified ? 'Your account email is verified.' : 'Verify your email to make account recovery and future security notices more reliable.'}</p>{user.email_verified ? <span className="settings-good"><Check size={14} /> Email verified</span> : <button className="ghost-button" disabled={busy} onClick={resendVerification}>Send verification email</button>}</section><section className="settings-section"><strong>How River remembers</strong><p>Automatic mode saves clear everyday details such as interests and projects. Review-first asks before every memory. Sensitive details always require review.</p><select className="settings-input" aria-label="Memory saving mode" value={memoryMode} onChange={e => changeMemoryMode(e.target.value)} disabled={!enabled}><option value="auto">Automatic for clear details</option><option value="review">Review every memory</option></select></section><section className="settings-section"><strong>Conversation retention</strong><p>Choose how long River keeps your message history. Approved memories are managed separately in the Memory panel.</p><select className="settings-input" aria-label="Conversation retention" value={retentionDays} onChange={e => changeRetention(e.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="-1">Keep until I delete</option></select></section><section className="settings-section"><strong>Two-step sign-in</strong><p>{mfaSetup ? 'Use your authenticator app to scan or enter this secret.' : 'Protect your account with an authenticator app.'}</p>{mfaSetup && <><code className="mfa-secret">{mfaSetup.secret}</code><button className="text-action" onClick={() => navigator.clipboard?.writeText(mfaSetup.secret)}><Copy size={13} /> Copy secret</button><input className="settings-input" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Six-digit code" /><button className="save-button" disabled={busy || otp.length !== 6} onClick={enableMfa}>Enable protection</button></>}{!mfaSetup && !user.mfa_enabled && <button className="ghost-button" disabled={busy} onClick={setupMfa}>Set up authenticator</button>}{user.mfa_enabled && <span className="settings-good"><Check size={14} /> Authenticator protection is enabled</span>}</section><section className="settings-section"><strong>Passkeys</strong><p>{passkeyStatus?.message || 'Checking passkey availability…'}</p><small>River has the credential store foundation, but enrollment stays off until a vetted WebAuthn ceremony and device test are complete.</small></section><section className="settings-section"><strong>Signed-in devices</strong><p>Revoke a session you do not recognize. Signing out everywhere immediately invalidates all existing sessions.</p>{sessions.length === 0 ? <small>No active sessions found.</small> : sessions.map(session => <div className="session-row" key={session.id}><span>{session.user_agent || 'Browser session'}<small>{new Date(session.created_at).toLocaleDateString()}</small></span><button className="text-action danger" onClick={() => revokeSession(session.id)}>Revoke</button></div>)}{sessions.length > 0 && <button className="text-action danger" disabled={busy} onClick={revokeAllSessions}>Sign out every device</button>}</section><section className="settings-section"><strong>Recent security activity</strong><p>New sign-ins, failed attempts, authenticator changes, and session revocations appear here.</p>{securityEvents.length ? securityEvents.slice(0, 5).map(event => <div className="session-row" key={`${event.event}-${event.created_at}`}><span>{event.event.replace('auth.', '').replaceAll('_', ' ')}<small>{new Date(event.created_at).toLocaleString()}</small></span></div>) : <small>No recent security activity found.</small>}</section><section className="settings-section"><strong>Your data</strong><p>Download a portable copy, or permanently delete your account.</p><button className="ghost-button" onClick={onExport}>Download my data</button><div className="delete-row"><input className="settings-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirm password to delete" /><button className="text-action danger" disabled={busy} onClick={deleteAccount}>Delete account</button></div></section>{notice && <div className="settings-notice" role="status">{notice}</div>}<div className="privacy-actions"><button className="ghost-button" onClick={onClose}>Done</button></div></section></div>
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
  useEscapeDismiss(onClose)
  const startEdit = story => { setEditing(story.id); setDraft({ topic: story.topic, summary: story.summary }) }
  const save = async id => { await onUpdate(id, draft); setEditing(null) }
  const showHistory = async id => { if (historyFor === id) { setHistoryFor(null); return } const data = await onHistory(id); setHistory(data.events); setHistoryFor(id) }
  return <aside className="memory-panel" aria-label="Memory panel"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> private memory</div><h2>Storylines</h2></div><button className="icon-button" aria-label="Close memory panel" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">The things you’ve shared that are still in motion. You’re always in control.</p>{proposals.length > 0 && <div className="proposal-list"><div className="eyebrow"><span className="eyebrow-dot" /> review before remembering</div>{proposals.map(p => <article className="proposal-card" key={p.id}><strong>{p.topic}</strong><p>{p.summary}</p><small>{p.sensitivity === 'sensitive' ? 'Sensitive memory · ' : ''}{p.conflict_storyline_id ? 'May revise an existing memory · ' : ''}{Math.round(p.confidence * 100)}% confidence · “{p.source_quote}”</small><div className="edit-actions"><button className="ghost-button" onClick={() => onReject(p.id)}>Not now</button><button className="save-button" onClick={() => onApprove(p.id)}><Check size={14} /> Remember</button></div></article>)}</div>}<div className="memory-stats"><div><strong>{storylines.length}</strong><span>remembered</span></div><div><strong>{storylines.filter(s => s.status === 'open').length}</strong><span>open threads</span></div></div><div className="storyline-list">{storylines.length === 0 ? <div className="empty-memory"><div className="empty-icon"><BookOpen size={20} /></div><strong>Your memory is quiet.</strong><span>As you talk, the things that matter will gather here.</span></div> : storylines.map(s => <article className={`storyline-card ${s.status}`} key={s.id}>{editing === s.id ? <div className="edit-form"><input aria-label="Memory topic" value={draft.topic} onChange={e => setDraft({ ...draft, topic: e.target.value })} /><textarea aria-label="Memory summary" value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /><div className="edit-actions"><button className="ghost-button" onClick={() => setEditing(null)}>Cancel</button><button className="save-button" onClick={() => save(s.id)}><Check size={14} /> Save</button></div></div> : <><div className="storyline-top"><span className={`status-pill ${s.status}`}>{s.status === 'open' ? 'Open' : s.status === 'stale' ? 'Quiet' : 'Resolved'}</span><button className="card-menu" aria-label={`Edit ${s.topic}`} onClick={() => startEdit(s)}><Pencil size={14} /></button></div><h3>{s.topic}</h3><p>{s.summary}</p>{s.source_quotes?.[0] && <div className="quote"><Quote size={13} /><span>{s.source_quotes[0]}</span></div>}<div className="storyline-foot"><span><Clock3 size={12} /> {s.status === 'open' ? 'Follow up soon' : '2 months ago'}</span><div><button className="history-button" onClick={() => showHistory(s.id)}>History</button><button onClick={() => onDelete(s.id)} aria-label="Delete memory"><Trash2 size={13} /></button></div></div>{historyFor === s.id && <div className="memory-history">{history.length ? history.map(event => <span key={`${event.event}-${event.created_at}`}>{event.event.replace('memory.', '').replace('_', ' ')} · {new Date(event.created_at).toLocaleDateString()}</span>) : <span>No recorded changes yet.</span>}</div>}</>}</article>)}</div><div className="panel-footer"><CircleHelp size={14} /><span>River only uses approved summaries — never your raw chat history — to keep the thread.</span></div></aside>
}

function EmptyState({ user, onSeed, onPrompt }) {
  return <div className="empty-state"><div className="hello-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hello-mark"><Sparkles size={24} /></div></div><div className="eyebrow centered"><span className="eyebrow-dot" /> your space, your pace</div><h1>What’s here today,<br /><em>{user.name.split(' ')[0]}?</em></h1><p>Start anywhere. River keeps your conversations private and gradually learns the clear things that matter; sensitive or uncertain memories stay under your review.</p><ol className="onboarding-steps" aria-label="How River works"><li><strong>Talk in threads</strong><span>Keep different parts of life in their own space.</span></li><li><strong>Memory with care</strong><span>Clear everyday details can be remembered; sensitive details ask first.</span></li><li><strong>Come back anytime</strong><span>Search, edit, export, or delete on your terms.</span></li></ol><div className="prompt-grid"><button onClick={() => onPrompt('I have something on my mind that I want to unpack.')}><span>Unpack something</span><small>that’s been circling</small><ArrowUp size={15} /></button><button onClick={() => onPrompt('Help me make a small plan for today.')}><span>Make a small plan</span><small>one next step at a time</small><ArrowUp size={15} /></button><button className="memory-prompt" onClick={onSeed}><span>Explore memory</span><small>see what River has learned</small><BookOpen size={15} /></button></div></div>
}

function TodayPanel({ reminders, storylines, onClose, onOpenMemory }) {
  useEscapeDismiss(onClose)
  return <div className="privacy-overlay"><section className="privacy-card today-card" role="dialog" aria-modal="true" aria-label="Today in River"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> a gentle check-in</div><h2>Today</h2></div><button className="icon-button" aria-label="Close today" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">A quiet view of the things you may want to return to. Nothing is sent outside River.</p><div className="today-stats"><div><strong>{storylines.filter(storyline => storyline.status === 'open').length}</strong><span>open storylines</span></div><div><strong>{reminders.length}</strong><span>gentle follow-ups</span></div></div><section className="today-reminders"><div className="eyebrow"><Bell size={12} /> follow-ups</div>{reminders.length ? reminders.map(reminder => <article className="reminder-card" key={reminder.id}><strong>{reminder.topic}</strong><p>{reminder.summary}</p><small>Due {new Date(reminder.follow_up_due).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></article>) : <div className="today-empty">No follow-ups are due. You can simply start wherever you are.</div>}</section><div className="privacy-actions"><button className="ghost-button" onClick={onOpenMemory}>Open memory</button><button className="save-button" onClick={onClose}>Done</button></div></section></div>
}

function VoiceScreen({ onBack, onSend, onLiveTurn }) {
  const [state, setState] = useState('idle')
  const [turnMode, setTurnMode] = useState('handsfree')
  const [message, setMessage] = useState('Start once. River listens for a sustained voice, waits for a natural pause, then responds.')
  const streamRef = useRef(null), audioRef = useRef(null), recorderRef = useRef(null), audioUrlRef = useRef(null), speechAbortRef = useRef(null)
  const contextRef = useRef(null), analyserRef = useRef(null), monitorRef = useRef(null), recognitionRef = useRef(null), conversationRef = useRef(false)
  const liveSocketRef = useRef(null), liveProcessorRef = useRef(null), liveInputSourceRef = useRef(null), liveSourcesRef = useRef(new Set()), liveNextPlaybackRef = useRef(0), liveInputRef = useRef(''), liveOutputRef = useRef(''), liveReconnectAttemptsRef = useRef(0), liveReconnectTimerRef = useRef(null), liveReadyTimerRef = useRef(null), liveActiveRef = useRef(false)
  const [liveActive, setLiveActive] = useState(false)
  const stateRef = useRef('idle'), heardSpeechRef = useRef(false), lastSpeechRef = useRef(0), speechOnsetRef = useRef(0), turnStartedRef = useRef(0), noiseFloorRef = useRef(2.2), interimRef = useRef(''), turnNonceRef = useRef(0), manualTurnRef = useRef(false)
  const setVoiceState = value => { stateRef.current = value; setState(value) }
  const metric = (stage, startedAt, outcome = 'ok') => { if (startedAt) void api('/api/telemetry/voice', { method: 'POST', body: JSON.stringify({ stage, duration_ms: Date.now() - startedAt, outcome }) }).catch(() => {}) }
  const clearMonitor = () => { if (monitorRef.current) window.clearInterval(monitorRef.current); monitorRef.current = null }
  const clearLiveReadyTimer = () => { if (liveReadyTimerRef.current) window.clearTimeout(liveReadyTimerRef.current); liveReadyTimerRef.current = null }
  const stopRecognition = () => { try { recognitionRef.current?.stop() } catch {} recognitionRef.current = null }
  const discardAudio = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute('src') }; if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
  const clearLivePlayback = () => { liveSourcesRef.current.forEach(source => { try { source.stop() } catch {} }); liveSourcesRef.current.clear(); liveNextPlaybackRef.current = contextRef.current?.currentTime || 0 }
  const stop = () => {
    conversationRef.current = false; turnNonceRef.current += 1; clearMonitor(); clearLiveReadyTimer(); stopRecognition(); speechAbortRef.current?.abort(); speechAbortRef.current = null; if (liveReconnectTimerRef.current) window.clearTimeout(liveReconnectTimerRef.current); liveReconnectTimerRef.current = null; liveReconnectAttemptsRef.current = 0; liveActiveRef.current = false; setLiveActive(false)
    try { liveSocketRef.current?.close(1000, 'River voice session ended') } catch {} liveSocketRef.current = null
    try { liveProcessorRef.current?.disconnect() } catch {} liveProcessorRef.current = null
    try { liveInputSourceRef.current?.disconnect() } catch {} liveInputSourceRef.current = null; clearLivePlayback()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null
    contextRef.current?.close().catch(() => {}); contextRef.current = null; analyserRef.current = null; discardAudio()
    setVoiceState('idle'); setMessage('Voice conversation ended. River does not store your audio recording.')
  }
  useEffect(() => () => stop(), [])
  const volume = () => {
    if (!analyserRef.current) return 0
    const values = new Uint8Array(analyserRef.current.fftSize); analyserRef.current.getByteTimeDomainData(values)
    return values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length
  }
  const startInterimAwareness = () => {
    stopRecognition()
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) return
    try {
      const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = navigator.language || 'en-US'
      recognition.onresult = event => { interimRef.current = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim() }
      recognition.onerror = () => {}; recognitionRef.current = recognition; recognition.start()
    } catch {}
  }
  const pauseForCurrentTurn = () => {
    const words = interimRef.current.trim().split(/\s+/).filter(Boolean).length
    const soundsIncomplete = words >= 4 && !/[.!?]$/.test(interimRef.current.trim())
    const shortTurn = Date.now() - turnStartedRef.current < 1200
    return Math.max(shortTurn ? 1050 : 820, soundsIncomplete ? 1400 : 0)
  }
  const appendTranscript = (current, next) => {
    const value = String(next || '').trim()
    if (!value) return current
    if (!current || value.startsWith(current)) return value
    if (current.endsWith(value)) return current
    return `${current} ${value}`.trim()
  }
  const pcmBase64 = input => {
    const targetRate = 16000; const ratio = contextRef.current.sampleRate / targetRate; const output = new Uint8Array(Math.max(1, Math.floor(input.length / ratio)) * 2)
    for (let index = 0; index < output.length / 2; index += 1) { const sample = Math.max(-1, Math.min(1, input[Math.min(input.length - 1, Math.floor(index * ratio))] || 0)); const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff; output[index * 2] = value & 0xff; output[index * 2 + 1] = (value >> 8) & 0xff }
    let binary = ''; for (const byte of output) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  const playLivePcm = encoded => {
    if (!contextRef.current || !encoded) return
    const binary = atob(encoded); const samples = new Float32Array(Math.floor(binary.length / 2))
    for (let index = 0; index < samples.length; index += 1) { const lo = binary.charCodeAt(index * 2); const hi = binary.charCodeAt(index * 2 + 1); const value = (hi << 8) | lo; samples[index] = (value & 0x8000 ? value - 0x10000 : value) / 0x8000 }
    const audio = contextRef.current.createBuffer(1, samples.length, 24000); audio.copyToChannel(samples, 0)
    const source = contextRef.current.createBufferSource(); source.buffer = audio; source.connect(contextRef.current.destination); const startAt = Math.max(contextRef.current.currentTime + 0.025, liveNextPlaybackRef.current); liveNextPlaybackRef.current = startAt + audio.duration; liveSourcesRef.current.add(source); source.onended = () => liveSourcesRef.current.delete(source); source.start(startAt)
  }
  const persistLiveTurn = async () => {
    const content = liveInputRef.current.trim(); const reply = liveOutputRef.current.trim(); liveInputRef.current = ''; liveOutputRef.current = ''
    if (!content || !reply || !conversationRef.current) return
    try { await onLiveTurn(content, reply) } catch { setMessage('River spoke, but this turn could not be saved. You can keep talking or switch to text.') }
  }
  const reconnectLive = async () => {
    if (!conversationRef.current || liveReconnectAttemptsRef.current >= 1) throw new Error('Live voice disconnected. Use “Try again” to start a fresh voice session.')
    liveReconnectAttemptsRef.current += 1
    setVoiceState('connecting'); setMessage('Reconnecting the secure live voice session…')
    // Capture nodes belong to the closed socket. Recreate them for the fresh
    // ephemeral session while retaining the user's already-approved microphone.
    try { liveProcessorRef.current?.disconnect() } catch {} liveProcessorRef.current = null
    try { liveInputSourceRef.current?.disconnect() } catch {} liveInputSourceRef.current = null
    const session = await api('/api/voice/live/session')
    if (!session?.enabled) throw new Error('Live voice is unavailable. You can continue with press-to-talk voice or text.')
    await beginLive(session, true)
  }
  const beginLive = async (session, reuseMedia = false) => {
    const stream = reuseMedia && streamRef.current ? streamRef.current : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); streamRef.current = stream
    const AudioContextClass = window.AudioContext || window.webkitAudioContext; const context = reuseMedia && contextRef.current ? contextRef.current : new AudioContextClass(); contextRef.current = context; if (context.state === 'suspended') await context.resume()
    const socket = new WebSocket(session.gateway_url, ['river.live', session.token]); liveSocketRef.current = socket; liveActiveRef.current = false; setLiveActive(false)
    liveReadyTimerRef.current = window.setTimeout(() => {
      if (liveSocketRef.current !== socket || liveActiveRef.current) return
      liveSocketRef.current = null; liveActiveRef.current = false; setLiveActive(false)
      try { socket.close(1000, 'River live voice setup timed out') } catch {}
      setVoiceState('error'); setMessage('Live voice did not finish connecting. Try again, or use reliable press-to-talk voice.')
    }, 12000)
    const startCapture = () => {
      if (!conversationRef.current || liveProcessorRef.current) return
      const source = context.createMediaStreamSource(stream); const processor = context.createScriptProcessor(2048, 1, 1); liveInputSourceRef.current = source; liveProcessorRef.current = processor
      processor.onaudioprocess = event => { if (socket.readyState !== WebSocket.OPEN || !conversationRef.current) return; socket.send(JSON.stringify({ realtimeInput: { audio: { data: pcmBase64(event.inputBuffer.getChannelData(0)), mimeType: 'audio/pcm;rate=16000' } } })) }
      source.connect(processor); processor.connect(context.destination); liveActiveRef.current = true; setLiveActive(true); setVoiceState('listening'); setMessage('Live voice is listening. River will respond after a natural pause.')
    }
    socket.onmessage = event => {
      let payload; try { payload = JSON.parse(event.data) } catch { return }
      if (payload.type === 'session.ready') { clearLiveReadyTimer(); startCapture(); return }
      if (payload.type === 'error') {
        if (liveSocketRef.current !== socket) return
        // Live voice is an enhancement, not a single point of failure. A
        // rejected upstream session must never leave someone on a dead voice
        // screen: release every live resource and continue with River's
        // authenticated, press-to-talk pipeline automatically.
        clearLiveReadyTimer(); liveSocketRef.current = null; liveActiveRef.current = false; setLiveActive(false)
        try { liveProcessorRef.current?.disconnect() } catch {}; liveProcessorRef.current = null
        try { liveInputSourceRef.current?.disconnect() } catch {}; liveInputSourceRef.current = null
        streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null
        contextRef.current?.close().catch(() => {}); contextRef.current = null
        try { socket.close(1011, 'River live voice provider error') } catch {}
        conversationRef.current = false
        setVoiceState('connecting'); setMessage('Live voice is unavailable right now. Switching to reliable voice…')
        window.setTimeout(() => { void begin({ skipLive: true, mode: turnMode }) }, 0)
        return
      }
      const content = payload.serverContent; if (!content) return
      if (content.interrupted) { clearLivePlayback(); setVoiceState('listening'); setMessage('I’m listening. Go ahead.') }
      if (content.inputTranscription?.text) liveInputRef.current = appendTranscript(liveInputRef.current, content.inputTranscription.text)
      if (content.outputTranscription?.text) liveOutputRef.current = appendTranscript(liveOutputRef.current, content.outputTranscription.text)
      for (const part of content.modelTurn?.parts || []) if (part.inlineData?.data) { playLivePcm(part.inlineData.data); setVoiceState('speaking'); setMessage('River is responding. Speak naturally to interrupt.') }
      if (content.turnComplete) { void persistLiveTurn(); if (conversationRef.current) { setVoiceState('listening'); setMessage('Listening for what you want to say next…') } }
    }
    socket.onerror = () => { if (conversationRef.current && liveSocketRef.current === socket) { setVoiceState('connecting'); setMessage('Live voice connection is recovering…') } }
    socket.onclose = event => {
      if (liveSocketRef.current !== socket) return
      clearLiveReadyTimer()
      liveSocketRef.current = null; liveActiveRef.current = false; setLiveActive(false)
      if (!conversationRef.current || event.wasClean) return
      if (liveReconnectAttemptsRef.current < 1) {
        setVoiceState('connecting'); setMessage('Live voice connection dropped. Reconnecting once…')
        liveReconnectTimerRef.current = window.setTimeout(() => { reconnectLive().catch(error => { setVoiceState('error'); setMessage(error.message || 'Live voice disconnected. Try again or continue by text.') }) }, 500)
      } else { setVoiceState('error'); setMessage('Live voice disconnected. Try again, or use reliable press-to-talk voice.') }
    }
  }
  const playCurrentReply = async () => {
    if (!audioRef.current?.src) throw new Error('River’s audio reply is no longer available. Please speak again.')
    audioRef.current.onended = () => { if (conversationRef.current) beginListening(false) }
    audioRef.current.onerror = () => { setVoiceState('awaiting-playback'); setMessage('River created a reply, but your browser could not play it. Check tab sound, then try again or continue by text.') }
    await audioRef.current.play(); setVoiceState('speaking'); setMessage('River is speaking. Start a sustained sentence to interrupt.')
  }
  const completeTurn = async (chunks, mimeType, nonce, captureStartedAt) => {
    if (!conversationRef.current || nonce !== turnNonceRef.current || !heardSpeechRef.current) return
    const transcriptionStartedAt = Date.now()
    try {
      setVoiceState('thinking'); setMessage('Understanding what you said…'); stopRecognition()
      const { transcript } = await apiAudio('/api/voice/transcribe', new Blob(chunks, { type: mimeType || 'audio/webm' })); metric('transcription', transcriptionStartedAt)
      if (!conversationRef.current || nonce !== turnNonceRef.current) return
      const replyStartedAt = Date.now(); setMessage('River is thinking…')
      const reply = await onSend(transcript, { voice: true }); metric('reply', replyStartedAt, reply ? 'ok' : 'error')
      if (!reply) throw new Error('River could not create a reply.')
      if (!conversationRef.current || nonce !== turnNonceRef.current) return
      const speechStartedAt = Date.now(); setMessage('Preparing River’s reply…'); speechAbortRef.current = new AbortController()
      const csrf = document.cookie.split('; ').find(value => value.startsWith('river_csrf='))?.split('=')[1]
      const speech = await fetch('/api/voice/speak', { method: 'POST', credentials: 'include', signal: speechAbortRef.current.signal, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: JSON.stringify({ text: reply }) })
      if (!speech.ok) { const data = await speech.json().catch(() => ({})); throw new Error(data.error || 'River could not create spoken audio.') }
      const audio = await speech.blob(); metric('speech', speechStartedAt)
      if (!conversationRef.current || nonce !== turnNonceRef.current) return
      discardAudio(); audioUrlRef.current = URL.createObjectURL(audio); audioRef.current.src = audioUrlRef.current
      try { await playCurrentReply() } catch { setVoiceState('awaiting-playback'); setMessage('Your browser paused River’s audio. Tap “Play River’s reply” to hear it and continue.') }
    } catch (error) {
      if (error.name === 'AbortError') return
      metric('turn', captureStartedAt, 'error'); setVoiceState('error'); setMessage(error.message || 'Voice could not complete. Try again.')
    }
  }
  const beginListening = (manual = false) => {
    if (!conversationRef.current || !streamRef.current || recorderRef.current?.state === 'recording') return
    const chunks = []; const recorder = new MediaRecorder(streamRef.current); const nonce = ++turnNonceRef.current; const captureStartedAt = Date.now(); recorderRef.current = recorder
    manualTurnRef.current = manual; heardSpeechRef.current = false; lastSpeechRef.current = captureStartedAt; speechOnsetRef.current = 0; turnStartedRef.current = captureStartedAt; interimRef.current = ''
    if (!manual) startInterimAwareness()
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => { setVoiceState('error'); setMessage('Your microphone recording stopped unexpectedly. Try reconnecting voice.') }
    recorder.onstop = () => { if (recorderRef.current === recorder) recorderRef.current = null; metric('capture', captureStartedAt, manual ? 'manual' : 'ok'); void completeTurn(chunks, recorder.mimeType, nonce, captureStartedAt) }
    recorder.start(250); setVoiceState('listening'); setMessage(manual ? 'Listening while you hold the button…' : 'Listening… River will wait for a natural pause.')
  }
  const stopManualTurn = () => { if (manualTurnRef.current && recorderRef.current?.state === 'recording') { heardSpeechRef.current = true; recorderRef.current.stop() } }
  const begin = async ({ skipLive = false, mode = turnMode } = {}) => {
    setVoiceState('connecting'); setMessage('Checking your microphone permission…')
    try {
      const live = skipLive ? null : await api('/api/voice/live/session').catch(() => null)
      if (live?.enabled) { conversationRef.current = true; liveReconnectAttemptsRef.current = 0; await beginLive(live); return }
      const session = await api('/api/voice/session')
      if (!session.enabled || session.provider !== 'groq') throw new Error('Groq voice is not configured for this River environment yet.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); streamRef.current = stream
      const AudioContextClass = window.AudioContext || window.webkitAudioContext; const context = new AudioContextClass(); contextRef.current = context
      if (context.state === 'suspended') await context.resume()
      const analyser = context.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.65; analyserRef.current = analyser; context.createMediaStreamSource(stream).connect(analyser)
      conversationRef.current = true
      monitorRef.current = window.setInterval(() => {
        if (!conversationRef.current) return
        const currentVolume = volume(); const now = Date.now(); const threshold = Math.max(2.5, noiseFloorRef.current * 2.15); const voiceDetected = currentVolume > threshold
        if (!voiceDetected && stateRef.current === 'listening') noiseFloorRef.current = Math.max(1.1, noiseFloorRef.current * .94 + currentVolume * .06)
        if (voiceDetected) {
          if (!speechOnsetRef.current) speechOnsetRef.current = now
          if (now - speechOnsetRef.current >= 180) { heardSpeechRef.current = true; lastSpeechRef.current = now }
        } else speechOnsetRef.current = 0
        const sustainedInterruption = currentVolume > Math.max(threshold * 1.75, noiseFloorRef.current + 4) && speechOnsetRef.current && now - speechOnsetRef.current >= 460
        if (stateRef.current === 'speaking' && sustainedInterruption) { metric('turn', turnStartedRef.current, 'interrupted'); speechAbortRef.current?.abort(); discardAudio(); beginListening(false); return }
        if (stateRef.current === 'listening' && !manualTurnRef.current && heardSpeechRef.current && now - turnStartedRef.current >= 520 && now - lastSpeechRef.current > pauseForCurrentTurn()) recorderRef.current?.stop()
      }, 80)
      if (mode === 'handsfree') beginListening(false)
      else { setVoiceState('ready'); setMessage('Press and hold the button while you speak. Release it when you are done.') }
    } catch (error) { conversationRef.current = false; clearMonitor(); clearLiveReadyTimer(); try { liveSocketRef.current?.close() } catch {} liveSocketRef.current = null; liveActiveRef.current = false; setLiveActive(false); try { liveProcessorRef.current?.disconnect() } catch {} liveProcessorRef.current = null; try { liveInputSourceRef.current?.disconnect() } catch {} liveInputSourceRef.current = null; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; contextRef.current?.close().catch(() => {}); contextRef.current = null; setVoiceState('error'); setMessage(error.message || 'Voice setup could not start. Check your microphone and try again.') }
  }
  const replay = async () => { try { await playCurrentReply() } catch { setMessage('Audio is still blocked. Check this tab’s sound/autoplay permission, then try again.') } }
  const restart = options => { stop(); void begin(options) }
  const switchMode = next => { setTurnMode(next); if (!conversationRef.current) return; if (liveSocketRef.current || liveActiveRef.current) { if (next === 'tap') { restart({ skipLive: true, mode: 'tap' }); return } setMessage('Live voice is listening continuously for your next thought.'); return } if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); if (next === 'handsfree') beginListening(false); else { setVoiceState('ready'); setMessage('Press and hold the button while you speak. Release it when you are done.') } }
  const canManualTurn = !liveActive && conversationRef.current && turnMode === 'tap' && ['ready', 'listening'].includes(state)
  return <div className="voice-screen"><button className="back-link" onClick={() => { stop(); onBack() }}>← back to text</button><div className="voice-screen-inner"><audio ref={audioRef} /><div className={`voice-breathe ${state === 'listening' ? 'recording' : ''}`}><div className="breathe-ring ring-a" /><div className="breathe-ring ring-b" /><div className="voice-center"><Mic size={30} /></div></div><div className="eyebrow centered"><span className="eyebrow-dot" /> {liveActive ? 'live voice mode' : 'adaptive voice mode'}</div><h2>Talk naturally.</h2><p>River listens for sustained speech, respects a real pause, and only then responds.</p><div className="voice-mode-control" role="group" aria-label="Voice input mode"><button className={turnMode === 'handsfree' ? 'active' : ''} onClick={() => switchMode('handsfree')}>Hands-free</button><button className={turnMode === 'tap' ? 'active' : ''} onClick={() => switchMode('tap')}>{liveActive ? 'Use reliable voice' : 'Press to talk'}</button></div><div className="voice-note"><Headphones size={16} /><span>{message}</span></div>{state === 'idle' || state === 'error' ? <div className="voice-recovery"><button className="ghost-button voice-start" onClick={() => restart()} disabled={state === 'connecting'}><Mic size={14} /> {state === 'error' ? 'Try live voice again' : 'Start conversation'}</button>{state === 'error' && <button className="save-button voice-start" onClick={() => { setTurnMode('tap'); restart({ skipLive: true, mode: 'tap' }) }}><Mic size={14} /> Use reliable voice</button>}</div> : <div className="voice-actions">{canManualTurn && <button className="save-button voice-start hold-to-talk" onPointerDown={() => beginListening(true)} onPointerUp={stopManualTurn} onPointerCancel={stopManualTurn} onPointerLeave={event => { if (event.buttons) stopManualTurn() }}><Mic size={14} /> Hold to talk</button>}{state === 'awaiting-playback' && <button className="save-button voice-start" onClick={replay}><Headphones size={14} /> Play River’s reply</button>}<button className="ghost-button voice-start" onClick={stop}><X size={14} /> End conversation</button></div>}</div></div>
}

function SearchPanel({ onClose, onSelectThread }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ messages: [], storylines: [] })
  const [busy, setBusy] = useState(false)
  useEscapeDismiss(onClose)
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
  useEscapeDismiss(onClose)
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
  const [memoryMode, setMemoryMode] = useState('auto')
  const [retentionDays, setRetentionDays] = useState(365)
  const [reminders, setReminders] = useState([])
  const [todayOpen, setTodayOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [error, setError] = useState('')
  const chatRef = useRef(null)
  useEffect(() => {
    document.querySelector('.account-row .icon-button.subtle')?.setAttribute('aria-label', 'Sign out')
  }, [])
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
      try { const [available] = await Promise.all([refreshThreads(), refreshReminders(), api('/api/privacy/preferences').then(data => { setMemoryEnabled(data.memory_enabled); setMemoryMode(data.memory_mode || 'auto'); setRetentionDays(data.retention_days) })]); if (available[0]) await loadThread(available[0].id) } catch (err) { setError(err.message) }
    }
    boot()
  }, [])
  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return
    const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 180
    if (nearBottom || messages.length <= 2) {
      chat.scrollTo({ top: chat.scrollHeight, behavior: busy ? 'auto' : 'smooth' })
    }
  }, [messages, busy])
  const send = async (content, options = {}) => { let threadId = activeThreadId; setBusy(true); setError(''); try { if (!threadId) { const created = await api('/api/threads', { method: 'POST', body: JSON.stringify({ title: 'Today' }) }); threadId = created.thread.id; setThreads(current => [created.thread, ...current]); setActiveThreadId(threadId) } const temp = { id: `temp-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }; setMessages(m => [...m, temp]); const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ content, thread_id: threadId, voice: Boolean(options.voice) }) }); setMessages(m => [...m.filter(x => x.id !== temp.id), temp, { id: `reply-${Date.now()}`, role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]); setStorylines(data.storylines); setProposals(data.proposals || []); void refreshThreads(); return data.reply } catch (err) { setMessages(m => m.filter(x => !String(x.id).startsWith('temp-'))); setError(err.message); return null } finally { setBusy(false) } }
  const saveLiveTurn = async (content, reply) => { let threadId = activeThreadId; if (!threadId) { const created = await api('/api/threads', { method: 'POST', body: JSON.stringify({ title: 'Today' }) }); threadId = created.thread.id; setThreads(current => [created.thread, ...current]); setActiveThreadId(threadId) }; const data = await api('/api/voice/live/turn', { method: 'POST', body: JSON.stringify({ content, reply, thread_id: threadId }) }); setMessages(current => [...current, { id: `live-user-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }, { id: `live-reply-${Date.now()}`, role: 'assistant', content: reply, created_at: new Date().toISOString() }]); setStorylines(data.storylines); setProposals(data.proposals || []); void refreshThreads(); return data }
  const seed = async () => { setSeeding(true); setMemoryOpen(true); setSeeding(false) }
  const update = async (id, draft) => { const data = await api(`/api/storylines/${id}`, { method: 'PUT', body: JSON.stringify(draft) }); setStorylines(s => s.map(x => x.id === id ? data.storyline : x)); await refreshReminders() }
  const remove = async id => { await api(`/api/storylines/${id}`, { method: 'DELETE' }); setStorylines(s => s.filter(x => x.id !== id)); await refreshReminders() }
  const approveProposal = async id => { const data = await api(`/api/memory/proposals/${id}/approve`, { method: 'POST' }); setStorylines(data.storylines); setProposals(data.proposals); await refreshReminders() }
  const rejectProposal = async id => { const data = await api(`/api/memory/proposals/${id}/reject`, { method: 'POST' }); setProposals(data.proposals) }
  const memoryHistory = id => api(`/api/storylines/${id}/history`)
  const savePreferences = async changes => { const data = await api('/api/privacy/preferences', { method: 'PUT', body: JSON.stringify({ memory_enabled: memoryEnabled, memory_mode: memoryMode, retention_days: retentionDays, ...changes }) }); setMemoryEnabled(data.memory_enabled); setMemoryMode(data.memory_mode || 'auto'); setRetentionDays(data.retention_days); return data }
  const toggleMemory = async enabled => { await savePreferences({ memory_enabled: enabled }); if (!enabled) setStorylines([]) }
  const changeRetention = days => savePreferences({ retention_days: days })
  const changeMemoryMode = mode => savePreferences({ memory_mode: mode })
  const exportData = async () => { try { const data = await api('/api/privacy/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `river-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url) } catch (err) { setError(err.message) } }
  const newThread = async () => { try { const data = await api('/api/threads', { method: 'POST', body: JSON.stringify({ title: 'New thread' }) }); setThreads(current => [data.thread, ...current]); setActiveThreadId(data.thread.id); setMessages([]); setProposals([]); setMode('text'); setMemoryOpen(false); setError(''); requestAnimationFrame(() => document.querySelector('.composer textarea')?.focus()) } catch (err) { setError(err.message) } }
  const renameThread = async thread => { const title = window.prompt('Name this conversation', thread.title)?.trim(); if (!title || title === thread.title) return; try { await api(`/api/threads/${thread.id}`, { method: 'PATCH', body: JSON.stringify({ title }) }); await refreshThreads() } catch (err) { setError(err.message) } }
  const deleteThread = async thread => { if (!window.confirm(`Delete “${thread.title}”? This only deletes this conversation.`)) return; try { await api(`/api/threads/${thread.id}`, { method: 'DELETE', body: '{}' }); const available = await refreshThreads(); if (thread.id === activeThreadId && available[0]) await loadThread(available[0].id) } catch (err) { setError(err.message) } }
  const hasMessages = messages.length > 0
  return <><div className="app-shell"><Sidebar user={user} threads={threads} activeThreadId={activeThreadId} onSelectThread={loadThread} onLogout={onLogout} onNew={newThread} onSeed={seed} seeding={seeding} onPrivacy={() => setPrivacyOpen(true)} onToday={() => setTodayOpen(true)} onMemory={() => setMemoryOpen(true)} onRenameThread={renameThread} onDeleteThread={deleteThread} /><main className="main-column"><header className="topbar"><div className="mobile-brand"><div className="brand-mark small"><Sparkles size={14} /></div>River</div><div className="session-label"><span className="live-dot" /> ongoing thread <ChevronDown size={14} /></div><div className="top-actions"><button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={17} /></button><button className={`memory-toggle ${memoryOpen ? 'active' : ''}`} onClick={() => setMemoryOpen(!memoryOpen)} aria-expanded={memoryOpen}><BookOpen size={15} /> <span>Memory</span><span className="memory-number">{storylines.length + proposals.length}</span></button><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={18} /></button></div></header>{mode === 'voice' ? <VoiceScreen onBack={() => setMode('text')} onSend={send} onLiveTurn={saveLiveTurn} /> : <><section ref={chatRef} className={`chat-area ${hasMessages ? 'has-messages' : ''}`}>{hasMessages ? <div className="message-list">{messages.map(m => <Message key={m.id} message={m} />)}{busy && <div className="thinking"><span className="mini-spark"><Sparkles size={11} /></span><span className="thinking-label">River is thinking</span><i /><i /><i /></div>}</div> : <EmptyState user={user} onSeed={seed} onPrompt={send} />}</section>{error && <div className="connection-notice" role="status">{error}</div>}<Composer onSend={send} busy={busy} mode={mode} setMode={setMode} /></>}</main>{memoryOpen && <><button className="memory-backdrop" aria-label="Dismiss memory overlay" onClick={() => setMemoryOpen(false)} /><MemoryPanel storylines={storylines} proposals={proposals} onUpdate={update} onDelete={remove} onApprove={approveProposal} onReject={rejectProposal} onHistory={memoryHistory} onClose={() => setMemoryOpen(false)} /></>}</div>{mobileNavOpen && <MobileMenuPanel onClose={() => setMobileNavOpen(false)} onNew={newThread} onToday={() => setTodayOpen(true)} onMemory={() => setMemoryOpen(true)} onPrivacy={() => setPrivacyOpen(true)} onLogout={onLogout} />}{todayOpen && <TodayPanel reminders={reminders} storylines={storylines} onClose={() => setTodayOpen(false)} onOpenMemory={() => { setTodayOpen(false); setMemoryOpen(true) }} />}{privacyOpen && <PrivacyPanel user={user} enabled={memoryEnabled} memoryMode={memoryMode} retentionDays={retentionDays} onToggle={toggleMemory} onMemoryModeChange={changeMemoryMode} onRetentionChange={changeRetention} onExport={exportData} onClose={() => setPrivacyOpen(false)} onAccountDeleted={onLogout} />}{searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} onSelectThread={loadThread} />}</>
}

function Root() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => { api('/api/auth/me').then(d => setUser(d.user)).catch(() => {}).finally(() => setChecking(false)) }, [])
  const logout = async () => { try { await api('/api/auth/logout', { method: 'POST', body: '{}' }) } catch {} finally { setUser(null) } }
  if (checking) return <div className="loading-screen"><div className="brand-mark"><Sparkles size={18} /></div><Loader2 className="spin" size={18} /></div>
  return user ? <App user={user} onLogout={logout} /> : <Auth onAuth={setUser} />
}

createRoot(document.getElementById('root')).render(<Root />)
