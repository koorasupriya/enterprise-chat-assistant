/**
 * Minimal Server-Sent Events parser for fetch() response bodies.
 *
 * Network chunks can end in the middle of an event (or even a UTF-8 character), so we keep
 * a text buffer and only emit events once their terminating blank line has arrived.
 */
export function createSSEParser(onEvent) {
  let buffer = ''
  return {
    push(text) {
      buffer += text.replace(/\r\n/g, '\n')
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = raw
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (data) onEvent(JSON.parse(data))
      }
    },
  }
}

/**
 * POST the conversation to the backend and call onEvent for every streamed event:
 *   {type: 'start' | 'token' | 'done' | 'error', ...}
 * Pass an AbortSignal to cancel (the Stop button).
 */
export async function streamChat({ messages, conversationId, signal, onEvent, baseUrl = '' }) {
  const res = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, conversation_id: conversationId ?? null }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`Request failed (${res.status})`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = createSSEParser(onEvent)
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parser.push(decoder.decode(value, { stream: true }))
  }
  parser.push(decoder.decode())
}
