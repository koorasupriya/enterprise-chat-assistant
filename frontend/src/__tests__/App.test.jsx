import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

/** Fake stream: emits the given tokens; can be held open until released. */
function fakeStream({ tokens = ['Hello', ' there'], error, hold = false } = {}) {
  const calls = []
  let release
  const gate = new Promise((r) => (release = r))
  const stream = async ({ messages, signal, onEvent }) => {
    calls.push(messages)
    onEvent({ type: 'start', conversation_id: 'c-1' })
    for (const t of tokens) onEvent({ type: 'token', content: t })
    if (hold) {
      await new Promise((resolve, reject) => {
        gate.then(resolve)
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    }
    if (error) onEvent({ type: 'error', message: error })
    else onEvent({ type: 'done', conversation_id: 'c-1' })
  }
  return { stream, calls, release: () => release() }
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ provider: 'demo' })))
})

describe('App', () => {
  it('shows suggestions and the provider badge', async () => {
    render(<App chatOptions={{ stream: fakeStream().stream }} />)
    expect(screen.getByText('How can I help today?')).toBeInTheDocument()
    expect(await screen.findByText('demo')).toBeInTheDocument()
  })

  it('sends a message with Enter and renders the streamed reply', async () => {
    const fake = fakeStream()
    render(<App chatOptions={{ stream: fake.stream }} />)
    await userEvent.type(screen.getByLabelText('Message'), 'Hi bot{Enter}')
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.getByTestId('msg-user')).toHaveTextContent('Hi bot')
    expect(fake.calls[0]).toEqual([{ role: 'user', content: 'Hi bot' }])
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('sends the whole conversation on the next turn', async () => {
    const fake = fakeStream({ tokens: ['A1'] })
    render(<App chatOptions={{ stream: fake.stream }} />)
    await userEvent.type(screen.getByLabelText('Message'), 'Q1{Enter}')
    await screen.findByText('A1')
    await userEvent.type(screen.getByLabelText('Message'), 'Q2{Enter}')
    await waitFor(() => expect(fake.calls).toHaveLength(2))
    expect(fake.calls[1].map((m) => m.content)).toEqual(['Q1', 'A1', 'Q2'])
  })

  it('Stop cancels a reply that is still streaming', async () => {
    const fake = fakeStream({ tokens: ['Partial'], hold: true })
    render(<App chatOptions={{ stream: fake.stream }} />)
    await userEvent.type(screen.getByLabelText('Message'), 'long question{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }))
    expect(await screen.findByText('Stopped')).toBeInTheDocument()
    expect(screen.getByText('Partial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('shows an error with Retry, and retry resends the question', async () => {
    const failing = fakeStream({ tokens: [], error: 'The assistant failed to respond.' })
    const { rerender } = render(<App chatOptions={{ stream: failing.stream }} />)
    await userEvent.type(screen.getByLabelText('Message'), 'Q{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('failed to respond')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(failing.calls).toHaveLength(2))
    expect(failing.calls[1]).toEqual([{ role: 'user', content: 'Q' }])
  })

  it('New chat clears the conversation', async () => {
    render(<App chatOptions={{ stream: fakeStream().stream }} />)
    await userEvent.click(screen.getByText('What can you do?'))
    await screen.findByText('Hello there')
    await act(() => userEvent.click(screen.getByRole('button', { name: 'New chat' })))
    expect(screen.getByText('How can I help today?')).toBeInTheDocument()
  })
})
