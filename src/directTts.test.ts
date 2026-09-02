import { describe, expect, it, vi } from 'vitest'
import {
  DIRECT_TTS_ENDPOINT,
  DIRECT_TTS_FIXTURE_TEXT,
  DIRECT_TTS_FORMAT,
  DIRECT_TTS_MAX_BYTES,
  DIRECT_TTS_MODEL,
  DIRECT_TTS_VOICE,
  DirectTtsError,
  HtmlAudioSession,
  ObjectUrlLease,
  requestDirectSpeech,
  sanitizeEvidence,
  type RequestDependencies,
  type AudioElementLike,
} from './directTts'

function dependencies(fetch: typeof globalThis.fetch, online = true): RequestDependencies {
  let now = 0
  return {
    fetch,
    online: () => online,
    now: () => (now += 10),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  }
}

function audioResponse(body: BodyInit = new Uint8Array([1, 2, 3]), headers: HeadersInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg', ...headers } })
}

async function expectCategory(promise: Promise<unknown>, category: string) {
  await expect(promise).rejects.toMatchObject({ category })
}

describe('direct speech request', () => {
  it('constructs the fixed authenticated no-store request and buffers MP3', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(audioResponse())
    const result = await requestDirectSpeech('injected-test-value', undefined, dependencies(fetch))
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(DIRECT_TTS_ENDPOINT)
    expect(init?.method).toBe('POST')
    expect(init?.cache).toBe('no-store')
    expect(init?.headers).toEqual({ Authorization: 'Bearer injected-test-value', 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({
      model: DIRECT_TTS_MODEL,
      input: DIRECT_TTS_FIXTURE_TEXT,
      voice: DIRECT_TTS_VOICE,
      response_format: DIRECT_TTS_FORMAT,
      speed: 1,
    })
    expect(result.byteCount).toBe(3)
    expect(result.contentType).toBe('audio/mpeg')
  })

  it.each([
    [401, 'authentication'], [403, 'authentication'], [429, 'throttled'], [500, 'invalid-response'],
  ])('normalizes observable HTTP %i without reading its body', async (status, category) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('do not inspect', { status }))
    await expectCategory(requestDirectSpeech('x', undefined, dependencies(fetch)), category)
  })

  it('normalizes an opaque fetch rejection as cors-or-network', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expectCategory(requestDirectSpeech('x', undefined, dependencies(fetch)), 'cors-or-network')
  })

  it('skips offline before fetch', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expectCategory(requestDirectSpeech('x', undefined, dependencies(fetch, false)), 'offline')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('normalizes caller abort and timeout separately', async () => {
    const hangingFetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const abort = new AbortController()
    const cancelled = requestDirectSpeech('x', abort.signal, dependencies(hangingFetch))
    abort.abort()
    await expectCategory(cancelled, 'cancelled')

    const instantTimeout = dependencies(hangingFetch)
    instantTimeout.setTimeout = ((callback: TimerHandler) => { queueMicrotask(() => (callback as () => void)()); return 1 }) as typeof setTimeout
    instantTimeout.clearTimeout = vi.fn() as unknown as typeof clearTimeout
    await expectCategory(requestDirectSpeech('x', undefined, instantTimeout), 'timeout')
  })

  it('rejects unexpected, empty, declared-oversize, and streamed-oversize responses', async () => {
    const cases = [
      new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'text/plain' } }),
      audioResponse(new Uint8Array()),
      audioResponse(new Uint8Array([1]), { 'content-length': String(DIRECT_TTS_MAX_BYTES + 1) }),
      audioResponse(new Uint8Array(DIRECT_TTS_MAX_BYTES + 1)),
    ]
    for (const response of cases) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
      await expectCategory(requestDirectSpeech('x', undefined, dependencies(fetch)), 'invalid-response')
    }
  })
})

describe('secret exclusion and object URL lifetime', () => {
  it('drops prohibited fields and redacts key-like values recursively', () => {
    const keyLike = ['sk', 'ThisMustNotEscape1234'].join('-')
    const sanitized = sanitizeEvidence({
      run: { notes: `accidentally ${keyLike}`, status: 'ok' },
      Authorization: 'Bearer hidden',
      nested: { apiKey: 'hidden', objectUrl: 'blob:secret', fixtureAudio: [1, 2] },
    })
    expect(JSON.stringify(sanitized)).toBe('{"run":{"notes":"accidentally [redacted]","status":"ok"},"nested":{}}')
  })

  it('revokes on replacement and every terminal clear without double revoke', () => {
    const revoke = vi.fn()
    let id = 0
    const lease = new ObjectUrlLease(() => `blob:test-${++id}`, revoke)
    expect(lease.replace(new Blob())).toBe('blob:test-1')
    expect(lease.replace(new Blob())).toBe('blob:test-2')
    lease.clear()
    lease.clear()
    expect(revoke.mock.calls).toEqual([['blob:test-1'], ['blob:test-2']])
  })

  it('uses an injected HTML media element for one-shot playback and revokes after end', async () => {
    class FakeAudio implements AudioElementLike {
      preload = ''
      src = ''
      currentTime = 0
      ended = false
      paused = false
      listeners = new Map<string, Array<() => void>>()
      play = vi.fn(async () => undefined)
      pause() { this.paused = true; this.emit('pause') }
      load() {}
      removeAttribute() { this.src = '' }
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
      }
      emit(type: string) { for (const listener of this.listeners.get(type) ?? []) listener() }
    }
    const audio = new FakeAudio()
    const revoke = vi.fn()
    const urls = new ObjectUrlLease(() => 'blob:injected', revoke)
    const session = new HtmlAudioSession(() => audio, urls)
    const hooks = {
      ready: vi.fn(), playing: vi.fn(), ended: vi.fn(), interrupted: vi.fn(),
      mediaFailed: vi.fn(), playbackBlocked: vi.fn(),
    }
    await session.play(new Blob([new Uint8Array([1])]), hooks)
    expect(audio.src).toBe('blob:injected')
    audio.emit('loadeddata')
    audio.emit('playing')
    audio.ended = true
    audio.emit('ended')
    expect(hooks.ready).toHaveBeenCalledOnce()
    expect(hooks.playing).toHaveBeenCalledOnce()
    expect(hooks.ended).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:injected')
    expect(session.active).toBe(false)
  })

  it('normalizes injected media error, interruption, blocked play, and replacement cleanup', async () => {
    function fakeAudio(blocked = false): AudioElementLike & { emit(type: string): void; paused: boolean } {
      const listeners = new Map<string, Array<() => void>>()
      return {
        preload: '', src: '', currentTime: 1, ended: false, paused: false,
        play: blocked ? async () => { throw new Error('blocked') } : async () => undefined,
        pause() { this.paused = true; this.emit('pause') }, load() {}, removeAttribute() { this.src = '' },
        addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) ?? []), listener]) },
        emit(type) { for (const listener of listeners.get(type) ?? []) listener() },
      }
    }
    const first = fakeAudio()
    const blocked = fakeAudio(true)
    const queue = [first, blocked]
    const revoke = vi.fn()
    const session = new HtmlAudioSession(() => queue.shift()!, new ObjectUrlLease(() => `blob:${queue.length}`, revoke))
    const hooks = {
      ready: vi.fn(), playing: vi.fn(), ended: vi.fn(), interrupted: vi.fn(),
      mediaFailed: vi.fn(), playbackBlocked: vi.fn(),
    }
    await session.play(new Blob(), hooks)
    first.emit('pause')
    first.emit('error')
    expect(hooks.interrupted).toHaveBeenCalledOnce()
    expect(hooks.mediaFailed).toHaveBeenCalledOnce()
    await session.play(new Blob(), hooks)
    expect(hooks.playbackBlocked).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledTimes(2)
  })
})
