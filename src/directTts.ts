export const DIRECT_TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech'
export const DIRECT_TTS_MODEL = 'gpt-4o-mini-tts-2025-12-15'
export const DIRECT_TTS_VOICE = 'alloy'
export const DIRECT_TTS_FORMAT = 'mp3'
export const DIRECT_TTS_FIXTURE_ID = 'wheel-awaits-v1'
export const DIRECT_TTS_FIXTURE_TEXT = 'The Wheel of Pain awaits.'
export const DIRECT_TTS_MAX_BYTES = 2 * 1024 * 1024
export const DIRECT_TTS_TIMEOUT_MS = 20_000

export type DirectTtsFailure =
  | 'cors-or-network'
  | 'timeout'
  | 'authentication'
  | 'throttled'
  | 'invalid-response'
  | 'media'
  | 'playback-blocked'
  | 'offline'
  | 'cancelled'

export class DirectTtsError extends Error {
  constructor(public readonly category: DirectTtsFailure) {
    super(category)
    this.name = 'DirectTtsError'
  }
}

export interface SpeechTimings {
  fetchResolvedMs: number
  completeMs: number
  byteCount: number
  contentType: string
  statusClass: string
}

export interface SpeechResult extends SpeechTimings {
  blob: Blob
}

export type FetchResolvedObserver = (observation: Pick<SpeechTimings, 'fetchResolvedMs' | 'contentType' | 'statusClass'>) => void

export interface RequestDependencies {
  fetch: typeof fetch
  now: () => number
  online: () => boolean
  setTimeout: typeof globalThis.setTimeout
  clearTimeout: typeof globalThis.clearTimeout
}

const defaultRequestDependencies: RequestDependencies = {
  fetch: globalThis.fetch.bind(globalThis),
  now: () => performance.now(),
  online: () => navigator.onLine,
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
}

function httpFailure(status: number): DirectTtsFailure {
  if (status === 401 || status === 403) return 'authentication'
  if (status === 429) return 'throttled'
  return 'invalid-response'
}

function expectedAudioType(value: string) {
  const normalized = value.split(';', 1)[0].trim().toLowerCase()
  return normalized === 'audio/mpeg' || normalized === 'audio/mp3'
}

export async function requestDirectSpeech(
  key: string,
  outerSignal?: AbortSignal,
  dependencies: RequestDependencies = defaultRequestDependencies,
  onFetchResolved?: FetchResolvedObserver,
): Promise<SpeechResult> {
  if (!dependencies.online()) throw new DirectTtsError('offline')

  const startedAt = dependencies.now()
  const controller = new AbortController()
  let timedOut = false
  const abortFromOuter = () => controller.abort()
  outerSignal?.addEventListener('abort', abortFromOuter, { once: true })
  const timeout = dependencies.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, DIRECT_TTS_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await dependencies.fetch(DIRECT_TTS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DIRECT_TTS_MODEL,
          input: DIRECT_TTS_FIXTURE_TEXT,
          voice: DIRECT_TTS_VOICE,
          response_format: DIRECT_TTS_FORMAT,
          speed: 1,
        }),
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch (error) {
      if (timedOut) throw new DirectTtsError('timeout')
      if (controller.signal.aborted) throw new DirectTtsError('cancelled')
      throw new DirectTtsError('cors-or-network')
    }

    const fetchResolvedMs = dependencies.now() - startedAt
    const contentType = response.headers.get('content-type') ?? ''
    const statusClass = `${Math.floor(response.status / 100)}xx`
    onFetchResolved?.({ fetchResolvedMs, contentType, statusClass })
    if (!response.ok) throw new DirectTtsError(httpFailure(response.status))
    if (!expectedAudioType(contentType)) throw new DirectTtsError('invalid-response')

    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > DIRECT_TTS_MAX_BYTES) throw new DirectTtsError('invalid-response')

    const reader = response.body?.getReader()
    if (!reader) {
      const blob = await response.blob()
      if (blob.size === 0 || blob.size > DIRECT_TTS_MAX_BYTES) throw new DirectTtsError('invalid-response')
      return {
        blob: new Blob([blob], { type: contentType }),
        fetchResolvedMs,
        completeMs: dependencies.now() - startedAt,
        byteCount: blob.size,
        contentType,
        statusClass,
      }
    }

    const chunks: ArrayBuffer[] = []
    let byteCount = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > DIRECT_TTS_MAX_BYTES) {
        await reader.cancel()
        throw new DirectTtsError('invalid-response')
      }
      chunks.push(value.slice().buffer as ArrayBuffer)
    }
    if (byteCount === 0) throw new DirectTtsError('invalid-response')
    return {
      blob: new Blob(chunks, { type: contentType }),
      fetchResolvedMs,
      completeMs: dependencies.now() - startedAt,
      byteCount,
      contentType,
      statusClass,
    }
  } finally {
    dependencies.clearTimeout(timeout)
    outerSignal?.removeEventListener('abort', abortFromOuter)
  }
}

const OMITTED_EVIDENCE_KEYS = /authorization|api.?key|credential|secret|blob|object.?url|upstream.?body|fixture.?audio/i
const KEY_LIKE_VALUE = /\bsk-[A-Za-z0-9_-]{8,}\b/g

export function sanitizeEvidence(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replaceAll(DIRECT_TTS_FIXTURE_TEXT, '[fixture-text-omitted]')
      .replace(KEY_LIKE_VALUE, '[redacted]')
  }
  if (Array.isArray(value)) return value.map(sanitizeEvidence)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !OMITTED_EVIDENCE_KEYS.test(key))
        .map(([key, item]) => [key, sanitizeEvidence(item)]),
    )
  }
  return value
}

export class ObjectUrlLease {
  private current: string | null = null

  constructor(
    private readonly create: (blob: Blob) => string,
    private readonly revoke: (url: string) => void,
  ) {}

  replace(blob: Blob) {
    this.clear()
    this.current = this.create(blob)
    return this.current
  }

  clear(expected?: string) {
    if (!this.current) return
    if (expected && this.current !== expected) return
    this.revoke(this.current)
    this.current = null
  }
}

export interface AudioElementLike {
  preload: string
  src: string
  currentTime: number
  readonly ended: boolean
  play(): Promise<void>
  pause(): void
  load(): void
  removeAttribute(name: string): void
  addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void
}

export interface AudioSessionHooks {
  ready(): void
  playing(): void
  ended(): void
  interrupted(): void
  mediaFailed(): void
  playbackBlocked(): void
}

export class HtmlAudioSession {
  private current: AudioElementLike | null = null
  private currentUrl: string | null = null

  constructor(
    private readonly createAudio: () => AudioElementLike,
    private readonly urls: ObjectUrlLease,
  ) {}

  get active() {
    return this.current !== null
  }

  async play(blob: Blob, hooks: AudioSessionHooks) {
    this.stop()
    const audio = this.createAudio()
    const url = this.urls.replace(blob)
    this.current = audio
    this.currentUrl = url
    const finish = () => {
      if (this.current !== audio) return
      this.current = null
      this.currentUrl = null
      this.urls.clear(url)
    }
    audio.preload = 'auto'
    audio.addEventListener('loadeddata', hooks.ready, { once: true })
    audio.addEventListener('playing', hooks.playing, { once: true })
    audio.addEventListener('ended', () => { hooks.ended(); finish() }, { once: true })
    audio.addEventListener('error', () => { hooks.mediaFailed(); finish() }, { once: true })
    audio.addEventListener('pause', () => {
      if (this.current === audio && !audio.ended && audio.currentTime > 0) hooks.interrupted()
    })
    audio.src = url
    try {
      await audio.play()
    } catch {
      hooks.playbackBlocked()
      finish()
    }
  }

  stop() {
    const audio = this.current
    const url = this.currentUrl
    this.current = null
    this.currentUrl = null
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    if (url) this.urls.clear(url)
  }
}
