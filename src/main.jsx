import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUp, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Compass, Copy, Ellipsis, Headphones, Loader2, LogOut, Menu, Mic, MoreHorizontal, Pencil, Plus, Quote, Search, Send, Settings2, Sparkles, Trash2, X, Zap } from 'lucide-react'
import './styles.css'

const api = async (path, options = {}) => {
  const token = localStorage.getItem('kindred_token')
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ name, email, password }) })
      localStorage.setItem('kindred_token', data.token); onAuth(data.user)
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
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : mode === 'signup' ? 'Begin your thread' : 'Welcome back'}<ArrowUp size={17} /></button>
      </form>
      <div className="auth-note"><BookOpen size={14} /> Your conversations and memories are private to your account.</div>
    </section>
    <div className="auth-footer">Built for the in-between moments <span>·</span> river v0.1</div>
  </main>
}

function Sidebar({ user, onLogout, onNew, onSeed, seeding, onPrivacy }) {
  return <aside className="sidebar">
    <div className="sidebar-top"><div className="brand"><div className="brand-mark small"><Sparkles size={14} /></div><span>river</span></div><button className="icon-button subtle" aria-label="More options"><MoreHorizontal size={18} /></button></div>
    <button className="new-thread" onClick={onNew}><Plus size={16} /> Continue thread <span>⌘ N</span></button>
    <div className="nav-label">Your space</div>
    <nav className="nav-list"><button className="nav-item selected"><Compass size={17} /><span>Today</span><span className="nav-count">1</span></button><button className="nav-item"><BookOpen size={17} /><span>Memory</span></button></nav>
    <div className="sidebar-thread"><div className="nav-label">Recent</div><div className="thread-row"><span className="thread-dot" /><div><strong>Today</strong><small>Just now</small></div><MoreHorizontal size={15} /></div></div>
    <div className="sidebar-bottom">
      <button className="seed-button" onClick={onPrivacy}><Settings2 size={15} /> Privacy controls</button>
      <button className="seed-button" onClick={onSeed} disabled={seeding}><Zap size={15} /> {seeding ? 'Gathering threads…' : 'Seed a richer memory'}</button>
      <div className="account-row"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="account-copy"><strong>{user.name}</strong><small>Personal space</small></div><button className="icon-button subtle" onClick={onLogout}><LogOut size={15} /></button></div>
    </div>
  </aside>
}

function PrivacyPanel({ enabled, onToggle, onClose }) {
  return <div className="privacy-overlay"><section className="privacy-card" role="dialog" aria-modal="true" aria-label="Privacy controls"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> your control</div><h2>Privacy controls</h2></div><button className="icon-button" aria-label="Close privacy controls" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">River only keeps storylines when memory is enabled. You can turn this off at any time.</p><label className="privacy-toggle"><span><strong>Remember what matters</strong><small>Allow River to create and update short storyline summaries.</small></span><input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} /></label><div className="privacy-actions"><button className="ghost-button" onClick={onClose}>Done</button></div></section></div>
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
  return <div className="composer-wrap"><div className="mode-switch"><button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}><Send size={14} /> Text</button><button className={mode === 'voice' ? 'active' : ''} onClick={() => setMode('voice')}><Mic size={14} /> Voice <span className="coming">soon</span></button></div>{mode === 'text' ? <form className="composer" onSubmit={send}><textarea ref={textareaRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }} placeholder="What’s on your mind?" rows="1" aria-label="What’s on your mind?" /><button className="send-button" disabled={!value.trim() || busy} aria-label="Send message">{busy ? <Loader2 className="spin" size={18} /> : <ArrowUp size={18} />}</button></form> : <div className="voice-composer"><div className="voice-orb"><Mic size={21} /></div><div><strong>Voice is almost here</strong><span>The same thread, just spoken.</span></div><button className="ghost-button" onClick={() => setMode('text')}>Back to text</button></div>}<div className="composer-hint"><span>Kindred can make mistakes. Your memories are always yours to edit.</span><span className="shortcut"><kbd>↵</kbd> to send</span></div></div>
}

function MemoryPanel({ storylines, onUpdate, onDelete, onClose }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({})
  const startEdit = story => { setEditing(story.id); setDraft({ topic: story.topic, summary: story.summary }) }
  const save = async id => { await onUpdate(id, draft); setEditing(null) }
  return <aside className="memory-panel" aria-label="Memory panel"><div className="panel-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> private memory</div><h2>Storylines</h2></div><button className="icon-button" aria-label="Close memory panel" onClick={onClose}><X size={18} /></button></div><p className="panel-intro">The things you’ve shared that are still in motion. You’re always in control.</p><div className="memory-stats"><div><strong>{storylines.length}</strong><span>remembered</span></div><div><strong>{storylines.filter(s => s.status === 'open').length}</strong><span>open threads</span></div></div><div className="storyline-list">{storylines.length === 0 ? <div className="empty-memory"><div className="empty-icon"><BookOpen size={20} /></div><strong>Your memory is quiet.</strong><span>As you talk, the things that matter will gather here.</span></div> : storylines.map(s => <article className={`storyline-card ${s.status}`} key={s.id}>{editing === s.id ? <div className="edit-form"><input aria-label="Memory topic" value={draft.topic} onChange={e => setDraft({ ...draft, topic: e.target.value })} /><textarea aria-label="Memory summary" value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /><div className="edit-actions"><button className="ghost-button" onClick={() => setEditing(null)}>Cancel</button><button className="save-button" onClick={() => save(s.id)}><Check size={14} /> Save</button></div></div> : <><div className="storyline-top"><span className={`status-pill ${s.status}`}>{s.status === 'open' ? 'Open' : s.status === 'stale' ? 'Quiet' : 'Resolved'}</span><button className="card-menu" aria-label={`Edit ${s.topic}`} onClick={() => startEdit(s)}><Pencil size={14} /></button></div><h3>{s.topic}</h3><p>{s.summary}</p>{s.source_quotes?.[0] && <div className="quote"><Quote size={13} /><span>{s.source_quotes[0]}</span></div>}<div className="storyline-foot"><span><Clock3 size={12} /> {s.status === 'open' ? 'Follow up soon' : '2 months ago'}</span><button onClick={() => onDelete(s.id)} aria-label="Delete memory"><Trash2 size={13} /></button></div></>}</article>)}</div><div className="panel-footer"><CircleHelp size={14} /><span>Kindred only uses these short summaries — never your raw chat history — to keep the thread.</span></div></aside>
}

function EmptyState({ user, onSeed }) {
  return <div className="empty-state"><div className="hello-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hello-mark"><Sparkles size={24} /></div></div><div className="eyebrow centered"><span className="eyebrow-dot" /> your space, your pace</div><h1>What’s here today,<br /><em>{user.name.split(' ')[0]}?</em></h1><p>Start anywhere. I’ll keep hold of the things that matter<br className="desktop-only" /> and bring them back when the moment is right.</p><div className="prompt-grid"><button onClick={() => document.querySelector('textarea')?.focus()}><span>Unpack something</span><small>that’s been circling</small><ArrowUp size={15} /></button><button onClick={onSeed}><span>Show me what you remember</span><small>see the memory system in action</small><ArrowUp size={15} /></button></div></div>
}

function VoiceScreen({ onBack }) {
  return <div className="voice-screen"><button className="back-link" onClick={onBack}>← back to text</button><div className="voice-screen-inner"><div className="voice-breathe"><div className="breathe-ring ring-a" /><div className="breathe-ring ring-b" /><div className="voice-center"><Mic size={30} /></div></div><div className="eyebrow centered"><span className="eyebrow-dot" /> voice mode</div><h2>Say it out loud.</h2><p>The same River thread, without the typing. Voice will arrive here soon.</p><div className="voice-note"><Headphones size={16} /><span>Full-duplex voice with natural interruptions and shared memory.</span></div></div></div>
}

function App({ user, onLogout }) {
  const [messages, setMessages] = useState([])
  const [storylines, setStorylines] = useState([])
  const [memoryOpen, setMemoryOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [mode, setMode] = useState('text')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const chatRef = useRef(null)
  useEffect(() => { api('/api/conversation').then(data => { setMessages(data.messages); setStorylines(data.storylines) }).catch(() => {}); api('/api/privacy/preferences').then(data => setMemoryEnabled(data.memory_enabled)).catch(() => {}) }, [])
  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return
    const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 180
    if (nearBottom || messages.length <= 2) chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])
  const send = async content => { const temp = { id: `temp-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }; setMessages(m => [...m, temp]); setBusy(true); try { const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ content }) }); setMessages(m => [...m.filter(x => x.id !== temp.id), temp, { id: `reply-${Date.now()}`, role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]); setStorylines(data.storylines) } catch (err) { setMessages(m => [...m, { id: `error-${Date.now()}`, role: 'assistant', content: err.message, created_at: new Date().toISOString() }]) } finally { setBusy(false) } }
  const seed = async () => { setSeeding(true); try { const data = await api('/api/storylines/seed', { method: 'POST' }); setStorylines(data.storylines); setMemoryOpen(true) } finally { setSeeding(false) } }
  const update = async (id, draft) => { const data = await api(`/api/storylines/${id}`, { method: 'PUT', body: JSON.stringify(draft) }); setStorylines(s => s.map(x => x.id === id ? data.storyline : x)) }
  const remove = async id => { await api(`/api/storylines/${id}`, { method: 'DELETE' }); setStorylines(s => s.filter(x => x.id !== id)) }
  const toggleMemory = async enabled => { await api('/api/privacy/preferences', { method: 'PUT', body: JSON.stringify({ memory_enabled: enabled }) }); setMemoryEnabled(enabled); if (!enabled) setStorylines([]) }
  const newThread = () => { setMode('text'); setMemoryOpen(false); requestAnimationFrame(() => document.querySelector('.composer textarea')?.focus()) }
  const hasMessages = messages.length > 0
  return <><div className="app-shell"><Sidebar user={user} onLogout={onLogout} onNew={newThread} onSeed={seed} seeding={seeding} onPrivacy={() => setPrivacyOpen(true)} /><main className="main-column"><header className="topbar"><div className="mobile-brand"><div className="brand-mark small"><Sparkles size={14} /></div>River</div><div className="session-label"><span className="live-dot" /> ongoing thread <ChevronDown size={14} /></div><div className="top-actions"><button className="icon-button" aria-label="Search"><Search size={17} /></button><button className={`memory-toggle ${memoryOpen ? 'active' : ''}`} onClick={() => setMemoryOpen(!memoryOpen)} aria-expanded={memoryOpen}><BookOpen size={15} /> <span>Memory</span><span className="memory-number">{storylines.length}</span></button><button className="icon-button mobile-menu" aria-label="Open menu"><Menu size={18} /></button></div></header>{mode === 'voice' ? <VoiceScreen onBack={() => setMode('text')} /> : <><section ref={chatRef} className={`chat-area ${hasMessages ? 'has-messages' : ''}`}>{hasMessages ? <div className="message-list">{messages.map(m => <Message key={m.id} message={m} />)}{busy && <div className="thinking"><span className="mini-spark"><Sparkles size={11} /></span><span className="thinking-label">River is thinking</span><i /><i /><i /></div>}</div> : <EmptyState user={user} onSeed={seed} />}</section><Composer onSend={send} busy={busy} mode={mode} setMode={setMode} /></>}</main>{memoryOpen && <><button className="memory-backdrop" aria-label="Dismiss memory overlay" onClick={() => setMemoryOpen(false)} /><MemoryPanel storylines={storylines} onUpdate={update} onDelete={remove} onClose={() => setMemoryOpen(false)} /></>}</div>{privacyOpen && <PrivacyPanel enabled={memoryEnabled} onToggle={toggleMemory} onClose={() => setPrivacyOpen(false)} />}</>
}

function Root() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => { if (!localStorage.getItem('kindred_token')) return setChecking(false); api('/api/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('kindred_token')).finally(() => setChecking(false)) }, [])
  const logout = () => { localStorage.removeItem('kindred_token'); setUser(null) }
  if (checking) return <div className="loading-screen"><div className="brand-mark"><Sparkles size={18} /></div><Loader2 className="spin" size={18} /></div>
  return user ? <App user={user} onLogout={logout} /> : <Auth onAuth={setUser} />
}

createRoot(document.getElementById('root')).render(<Root />)
