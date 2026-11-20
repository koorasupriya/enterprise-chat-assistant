import { describe, expect, it, vi } from 'vitest'
import { createSSEParser, streamChat } from '../lib/sse.js'

describe('createSSEParser', () => {
  it('emits complete events only, across arbitrary chunk boundaries', () => {
    const events = []
    const p = createSSEParser((e) => events.push(e))
    p.push('data: {"type":"start","conversation_id":"c1"}\n\ndata: {"type":"tok')
    expect(events).toHaveLength(1)
    p.push('en","content":"Hi"}\n')
    expect(events).toHaveLength(1)
    p.push('\ndata: {"type":"done"}\n\n')
    expect(events.map((e) => e.type)).toEqual(['start', 'token', 'done'])
    expect(events[1].content).toBe('Hi')
  })

  it('handles CRLF line endings and ignores comments', () => {
    const events = []
    const p = createSSEParser((e) => events.push(e))
    p.push(': keep-alive\r\n\r\ndata: {"type":"done"}\r\n\r\n')
    expect(events).toEqual([{ type: 'done' }])
  })
})

describe('streamChat', () => {
  it('reads a streamed response body', async () => {
    const body = new ReadableStream({
      start(c) {
        const enc = new TextEncoder()
        c.enqueue(enc.encode('data: {"type":"token","content":"Hel'))
        c.enqueue(enc.encode('lo"}\n\ndata: {"type":"done"}\n\n'))
        c.close()
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 200 }))
    const events = []
    await streamChat({ messages: [{ role: 'user', content: 'hi' }], onEvent: (e) => events.push(e) })
    expect(events).toEqual([{ type: 'token', content: 'Hello' }, { type: 'done' }])
    const [, init] = fetch.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ messages: [{ role: 'user', content: 'hi' }], conversation_id: null })
  })

  it('throws on HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(streamChat({ messages: [], onEvent: () => {} })).rejects.toThrow('500')
  })
})
