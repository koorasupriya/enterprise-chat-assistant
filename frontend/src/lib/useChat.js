import { useCallback, useRef, useState } from 'react'
import { streamChat } from './sse.js'

let nextId = 1
const newId = () => `m${nextId++}`

/**
 * Chat state machine: idle -> streaming -> idle | error.
 * Messages are {id, role, content, status?} where an assistant message being written has status 'streaming'.
 */
export function useChat({ stream = streamChat } = {}) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle') // idle | streaming | error
  const [error, setError] = useState(null)
  const conversationId = useRef(null)
  const controller = useRef(null)

  const updateLast = (fn) =>
    setMessages((prev) => {
      const copy = prev.slice()
      copy[copy.length - 1] = fn(copy[copy.length - 1])
      return copy
    })

  const run = useCallback(
    async (history) => {
      const ctrl = new AbortController()
      controller.current = ctrl
      setStatus('streaming')
      setError(null)
      setMessages([...history, { id: newId(), role: 'assistant', content: '', status: 'streaming' }])

      let failed = null
      try {
        await stream({
          messages: history.map(({ role, content }) => ({ role, content })),
          conversationId: conversationId.current,
          signal: ctrl.signal,
          onEvent: (ev) => {
            if (ev.type === 'start') conversationId.current = ev.conversation_id
            else if (ev.type === 'token') updateLast((m) => ({ ...m, content: m.content + ev.content }))
            else if (ev.type === 'error') failed = ev.message
          },
        })
      } catch (err) {
        if (err.name !== 'AbortError') failed = 'Could not reach the assistant. Is the backend running?'
      }
      controller.current = null

      if (ctrl.signal.aborted) {
        updateLast((m) => ({ ...m, status: 'stopped' }))
        setStatus('idle')
      } else if (failed) {
        updateLast((m) => ({ ...m, status: 'error' }))
        setError(failed)
        setStatus('error')
      } else {
        updateLast((m) => ({ ...m, status: 'done' }))
        setStatus('idle')
      }
    },
    [stream],
  )

  const send = useCallback(
    (text) => {
      const content = text.trim()
      if (!content || controller.current) return
      // drop an unfinished/failed assistant reply before continuing the conversation
      const history = messages.filter((m) => !(m.role === 'assistant' && m.status === 'error'))
      run([...history, { id: newId(), role: 'user', content }])
    },
    [messages, run],
  )

  const stop = useCallback(() => controller.current?.abort(), [])

  const retry = useCallback(() => {
    const history = messages.filter((m) => !(m.role === 'assistant' && m.status === 'error'))
    if (history.length && history[history.length - 1].role === 'user') run(history)
  }, [messages, run])

  const reset = useCallback(() => {
    controller.current?.abort()
    conversationId.current = null
    setMessages([])
    setStatus('idle')
    setError(null)
  }, [])

  return { messages, status, error, send, stop, retry, reset }
}
