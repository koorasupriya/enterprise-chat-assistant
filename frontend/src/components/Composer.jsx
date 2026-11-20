import { useEffect, useRef, useState } from 'react'

export default function Composer({ onSend, onStop, streaming }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  // grow the textarea with its content, up to a limit set in CSS
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const submit = () => {
    if (!text.trim() || streaming) return
    onSend(text)
    setText('')
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        placeholder="Ask anything…"
        aria-label="Message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
      />
      {streaming ? (
        <button type="button" className="btn btn-stop" onClick={onStop}>
          Stop
        </button>
      ) : (
        <button type="submit" className="btn btn-send" disabled={!text.trim()}>
          Send
        </button>
      )}
    </form>
  )
}
