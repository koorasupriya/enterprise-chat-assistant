import { useEffect, useRef, useState } from 'react'
import Composer from './components/Composer.jsx'
import Message from './components/Message.jsx'
import { useChat } from './lib/useChat.js'
import { useTheme } from './lib/useTheme.js'

const SUGGESTIONS = ['What can you do?', 'How do I raise an IT ticket?', 'Summarise our leave policy']

export default function App({ chatOptions } = {}) {
  const { messages, status, error, send, stop, retry, reset } = useChat(chatOptions)
  const [theme, toggleTheme] = useTheme()
  const [provider, setProvider] = useState(null)
  const bottom = useRef(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => setProvider(h?.provider ?? 'offline'))
      .catch(() => setProvider('offline'))
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' })
  }, [messages])

  const streaming = status === 'streaming'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">◆</span>
          <span>Enterprise Chat Assistant</span>
          {provider && <span className={`badge badge-${provider}`}>{provider}</span>}
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={reset} disabled={!messages.length}>
            New chat
          </button>
          <button className="btn btn-ghost" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="thread" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty">
            <h1>How can I help today?</h1>
            <p>Ask a question, or try one of these:</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} message={m} />)
        )}
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button className="btn btn-ghost" onClick={retry}>
              Retry
            </button>
          </div>
        )}
        <div ref={bottom} />
      </main>

      <footer className="footer">
        <Composer onSend={send} onStop={stop} streaming={streaming} />
        <p className="hint">
          <span className="hint-keys">Enter to send · Shift+Enter for a new line · </span>
          AI answers can be wrong. Check important information.
        </p>
      </footer>
    </div>
  )
}
