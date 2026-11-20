import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Message({ message }) {
  const { role, content, status } = message
  const isUser = role === 'user'
  return (
    <div className={`msg msg-${role}`} data-testid={`msg-${role}`}>
      <div className="avatar" aria-hidden="true">{isUser ? 'You' : 'AI'}</div>
      <div className="bubble">
        {isUser ? (
          <p className="plain">{content}</p>
        ) : content ? (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {status === 'streaming' && <span className="cursor" aria-hidden="true" />}
          </div>
        ) : (
          <div className="typing" aria-label="Assistant is typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {status === 'stopped' && <div className="note">Stopped</div>}
      </div>
    </div>
  )
}
