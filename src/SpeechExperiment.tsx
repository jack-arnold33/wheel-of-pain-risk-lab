import { useEffect, useReducer, useRef, useState } from 'react'
import { initialSpeechState, speechReducer, type PreparedPlayback } from './speechState'

const FIXTURE_ID = 'generic-transition-v1'
const FIXTURE_TEXT = 'Test participant. Begin the next interval.'
const FIXTURE_URL = `${import.meta.env.BASE_URL}tts-fixture.wav`
const LIVE_PROXY_URL = import.meta.env.VITE_TTS_PROXY_URL?.trim() ?? ''

interface Props {
  disabled: boolean
  recordEvent: (type: string, detail: string) => void
}

interface PreparedAudio {
  operationId: number
  targetTransition: number
  source: 'static' | 'live'
  blob: Blob
  decoded?: AudioBuffer
}

interface TimedAudio {
  blob: Blob
  firstByteMs: number | null
  completeMs: number
}

function audioContextConstructor() {
  return window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

async function readAudioResponse(response: Response, startedAt: number): Promise<TimedAudio> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') ?? 'audio/mpeg'
  if (!response.body) {
    const blob = await response.blob()
    return { blob, firstByteMs: null, completeMs: performance.now() - startedAt }
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  let firstByteMs: number | null = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (firstByteMs === null) firstByteMs = performance.now() - startedAt
    chunks.push(value)
    length += value.length
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return {
    blob: new Blob([bytes], { type: contentType }),
    firstByteMs,
    completeMs: performance.now() - startedAt,
  }
}

function formatMs(value: number | null) {
  return value === null ? 'not measurable' : `${Math.round(value)}ms`
}

export default function SpeechExperiment({ disabled, recordEvent }: Props) {
  const [state, dispatch] = useReducer(speechReducer, initialSpeechState)
  const [status, setStatus] = useState('Idle; no audio buffered.')
  const [contextState, setContextState] = useState('not created')
  const [visibility, setVisibility] = useState(document.visibilityState)
  const operationRef = useRef(0)
  const transitionRef = useRef(0)
  const preparedRef = useRef<PreparedAudio | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  function context() {
    if (contextRef.current) return contextRef.current
    const Constructor = audioContextConstructor()
    if (!Constructor) throw new Error('Web Audio is unavailable')
    const created = new Constructor()
    created.addEventListener('statechange', () => {
      setContextState(created.state)
      log('speech.audio-context-state', 'web-audio', `state=${created.state}`)
      if (created.state === 'suspended' && sourceRef.current) {
        log('speech.interrupted', 'web-audio', 'reason=audio-context-suspended')
      }
    })
    contextRef.current = created
    setContextState(created.state)
    return created
  }

  function environment(method: string) {
    return `method=${method}; display=${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}; visibility=${document.visibilityState}; audioContext=${contextRef.current?.state ?? 'not-created'}`
  }

  useEffect(() => {
    const listener = () => {
      setVisibility(document.visibilityState)
      recordEvent('speech.visibility', environment('none'))
    }
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  }, [recordEvent])

  useEffect(() => () => {
    abortRef.current?.abort()
    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    try { sourceRef.current?.stop() } catch { /* already stopped */ }
    void contextRef.current?.close()
  }, [])

  function log(type: string, method: string, detail = '') {
    recordEvent(type, `${environment(method)}${detail ? `; ${detail}` : ''}`)
  }

  function stop(reason = 'tester requested stop', recordCancellation = true) {
    operationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    window.speechSynthesis?.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    try { sourceRef.current?.stop() } catch { /* already stopped */ }
    sourceRef.current = null
    preparedRef.current = null
    dispatch({ type: 'cancel', operationId: operationRef.current })
    setStatus('Cancelled; buffer cleared.')
    if (recordCancellation) {
      log('speech.cancelled', 'all', `reason=${reason}; operation=${operationRef.current}`)
    }
  }

  function clearBuffer() {
    preparedRef.current = null
    dispatch({ type: 'clear' })
    setStatus('Buffer cleared.')
    log('speech.buffer-cleared', state.playback)
  }

  function playBrowserSpeech() {
    if (!('speechSynthesis' in window)) {
      setStatus('Browser SpeechSynthesis is unavailable.')
      log('speech.failed', 'speech-synthesis', 'reason=unsupported')
      return
    }
    stop('starting browser baseline', false)
    const utterance = new SpeechSynthesisUtterance(FIXTURE_TEXT)
    const requestedAt = performance.now()
    log('speech.playback-requested', 'speech-synthesis', `fixture=${FIXTURE_ID}`)
    utterance.onstart = () => {
      setStatus('Browser speech is playing.')
      log('speech.playback-started', 'speech-synthesis', `latency=${Math.round(performance.now() - requestedAt)}ms`)
    }
    utterance.onend = () => {
      setStatus('Browser speech completed.')
      log('speech.completed', 'speech-synthesis')
    }
    utterance.onerror = (event) => {
      setStatus(`Browser speech failed: ${event.error}`)
      log(event.error === 'interrupted' || event.error === 'canceled' ? 'speech.interrupted' : 'speech.failed', 'speech-synthesis', `reason=${event.error}`)
    }
    window.speechSynthesis.speak(utterance)
  }

  async function playHtml(blobOrUrl: Blob | string, label: string) {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl)
    const audio = new Audio()
    audioRef.current = audio
    audio.preload = 'auto'
    const requestedAt = performance.now()
    let readyLogged = false
    log('speech.request-started', 'html-audio', `source=${label}; firstByte=not-measurable`)
    log('speech.playback-requested', 'html-audio', `source=${label}`)
    audio.addEventListener('loadeddata', () => {
      readyLogged = true
      log('speech.media-ready', 'html-audio', `latency=${Math.round(performance.now() - requestedAt)}ms`)
    }, { once: true })
    audio.addEventListener('playing', () => {
      setStatus('HTML audio is playing.')
      log('speech.playback-started', 'html-audio', `latency=${Math.round(performance.now() - requestedAt)}ms`)
    }, { once: true })
    audio.addEventListener('ended', () => {
      setStatus('HTML audio completed.')
      log('speech.completed', 'html-audio')
      if (typeof blobOrUrl !== 'string') URL.revokeObjectURL(url)
    }, { once: true })
    audio.addEventListener('error', () => {
      setStatus('HTML audio failed to load or play.')
      log('speech.failed', 'html-audio', `mediaError=${audio.error?.code ?? 'unknown'}; mediaReady=${readyLogged}`)
      if (typeof blobOrUrl !== 'string') URL.revokeObjectURL(url)
    }, { once: true })
    audio.addEventListener('pause', () => {
      if (!audio.ended && audio.currentTime > 0) log('speech.interrupted', 'html-audio', 'reason=pause-event')
    })
    audio.src = url
    try {
      await audio.play()
    } catch (error) {
      setStatus(`HTML audio play was rejected: ${String(error)}`)
      log('speech.failed', 'html-audio', `reason=${error instanceof Error ? error.name : 'play-rejected'}`)
      if (typeof blobOrUrl !== 'string') URL.revokeObjectURL(url)
    }
  }

  async function decode(blob: Blob, method: string) {
    const audioContext = context()
    if (audioContext.state === 'suspended') await audioContext.resume()
    const startedAt = performance.now()
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer())
    log('speech.media-ready', method, `decode=${Math.round(performance.now() - startedAt)}ms`)
    return decoded
  }

  async function playWebAudio(decoded: AudioBuffer, label: string) {
    const audioContext = context()
    if (audioContext.state === 'suspended') await audioContext.resume()
    const source = audioContext.createBufferSource()
    source.buffer = decoded
    source.connect(audioContext.destination)
    sourceRef.current = source
    const requestedAt = performance.now()
    log('speech.playback-requested', 'web-audio', `source=${label}`)
    source.addEventListener('ended', () => {
      if (sourceRef.current !== source) return
      sourceRef.current = null
      setStatus('Web Audio completed.')
      log('speech.completed', 'web-audio')
    }, { once: true })
    source.start()
    setStatus('Web Audio is playing.')
    log('speech.playback-started', 'web-audio', `latency=${Math.round(performance.now() - requestedAt)}ms; observation=inferred-from-source-start`)
  }

  async function playStaticWebAudio() {
    stop('starting static Web Audio', false)
    const operationId = operationRef.current
    const requestedAt = performance.now()
    log('speech.request-started', 'web-audio', `source=static; fixture=${FIXTURE_ID}`)
    try {
      const response = await fetch(FIXTURE_URL)
      const result = await readAudioResponse(response, requestedAt)
      if (operationId !== operationRef.current) return
      log('speech.first-response-byte', 'web-audio', `latency=${formatMs(result.firstByteMs)}; complete=${Math.round(result.completeMs)}ms`)
      const decoded = await decode(result.blob, 'web-audio')
      if (operationId !== operationRef.current) return
      await playWebAudio(decoded, 'static')
    } catch (error) {
      setStatus(`Web Audio failed: ${String(error)}`)
      log('speech.failed', 'web-audio', `reason=${error instanceof Error ? error.name : 'unknown'}`)
    }
  }

  async function prepare(source: 'static' | 'live') {
    stop(`starting ${source} preparation`, false)
    const operationId = ++operationRef.current
    const targetTransition = transitionRef.current + 1
    const abort = new AbortController()
    abortRef.current = abort
    dispatch({ type: 'prepare-request', operationId, targetTransition })
    setStatus(`Preparing ${source} audio for transition ${targetTransition}…`)
    const startedAt = performance.now()
    log('speech.request-started', state.playback, `source=${source}; fixture=${FIXTURE_ID}; targetTransition=${targetTransition}; textCharacters=${FIXTURE_TEXT.length}`)
    try {
      const response = await fetch(source === 'static' ? FIXTURE_URL : LIVE_PROXY_URL, {
        method: source === 'static' ? 'GET' : 'POST',
        headers: source === 'live' ? { 'content-type': 'application/json' } : undefined,
        body: source === 'live' ? JSON.stringify({ fixtureId: FIXTURE_ID, text: FIXTURE_TEXT }) : undefined,
        signal: abort.signal,
      })
      const result = await readAudioResponse(response, startedAt)
      log('speech.first-response-byte', state.playback, `source=${source}; latency=${formatMs(result.firstByteMs)}; complete=${Math.round(result.completeMs)}ms`)
      let decoded: AudioBuffer | undefined
      if (state.playback === 'web-audio') decoded = await decode(result.blob, 'web-audio')
      else log('speech.media-ready', 'html-audio', `source=${source}; bufferedBytes=${result.blob.size}`)

      if (operationId !== operationRef.current || targetTransition <= transitionRef.current) {
        log('speech.stale-result-rejected', state.playback, `source=${source}; targetTransition=${targetTransition}; currentTransition=${transitionRef.current}`)
        return
      }
      preparedRef.current = { operationId, targetTransition, source, blob: result.blob, decoded }
      dispatch({ type: 'prepare-success', operationId, targetTransition, source })
      setStatus(`${source} audio buffered for transition ${targetTransition}.`)
      log('speech.buffer-ready', state.playback, `source=${source}; targetTransition=${targetTransition}`)
    } catch (error) {
      if (operationId !== operationRef.current) return
      const reason = error instanceof Error ? error.name : 'unknown'
      setStatus(reason === 'AbortError' ? 'Preparation cancelled.' : `Preparation failed: ${String(error)}`)
      log(reason === 'AbortError' ? 'speech.cancelled' : 'speech.failed', state.playback, `source=${source}; reason=${reason}`)
    } finally {
      if (abortRef.current === abort) abortRef.current = null
    }
  }

  async function simulateTransition() {
    const transitionId = ++transitionRef.current
    const requestedAt = performance.now()
    const prepared = preparedRef.current
    dispatch({ type: 'transition', transitionId })
    log('speech.transition', state.playback, `transition=${transitionId}`)
    if (!prepared || prepared.targetTransition !== transitionId) {
      preparedRef.current = null
      setStatus(`Transition ${transitionId}: no current buffer; nothing played.`)
      log('speech.skipped', state.playback, `transition=${transitionId}; reason=no-current-buffer`)
      return
    }
    preparedRef.current = null
    dispatch({ type: 'consume', transitionId })
    log('speech.transition-play-requested', state.playback, `transition=${transitionId}; source=${prepared.source}`)
    try {
      if (state.playback === 'html-audio') await playHtml(prepared.blob, `buffered-${prepared.source}`)
      else await playWebAudio(prepared.decoded ?? await decode(prepared.blob, 'web-audio'), `buffered-${prepared.source}`)
      log('speech.transition-dispatch-complete', state.playback, `transition=${transitionId}; dispatchLatency=${Math.round(performance.now() - requestedAt)}ms`)
    } catch (error) {
      setStatus(`Buffered playback failed: ${String(error)}`)
      log('speech.failed', state.playback, `transition=${transitionId}; reason=${error instanceof Error ? error.name : 'unknown'}`)
    }
  }

  return (
    <section className="speech-panel" aria-labelledby="speech-heading">
      <div className="speech-heading">
        <div>
          <p className="section-label">RL-SPE external audio routing</p>
          <h2 id="speech-heading">Provider-neutral speech fixture</h2>
        </div>
        <dl className="speech-status">
          <div><dt>Display</dt><dd>{window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}</dd></div>
          <div><dt>Visibility</dt><dd>{visibility}</dd></div>
          <div><dt>AudioContext</dt><dd>{contextState}</dd></div>
          <div><dt>Transition</dt><dd>{state.transitionId}</dd></div>
        </dl>
      </div>
      <p className="privacy-note">
        Synthetic fixture only. Live mode sends the displayed generic sentence to the configured same-origin proxy;
        keys must remain on that server. Event metadata records the fixture ID and character count, never the sentence.
      </p>
      <p className="fixture-text"><strong>Fixture:</strong> “{FIXTURE_TEXT}”</p>
      <div className="speech-controls">
        <button onClick={playBrowserSpeech} disabled={disabled}>Browser SpeechSynthesis baseline</button>
        <button onClick={() => void playHtml(FIXTURE_URL, 'static')} disabled={disabled}>Static fixture · HTML audio</button>
        <button onClick={() => void playStaticWebAudio()} disabled={disabled}>Static fixture · Web Audio</button>
      </div>
      <div className="buffer-controls">
        <label>Buffered playback
          <select value={state.playback} onChange={(event) => dispatch({ type: 'select-playback', playback: event.target.value as PreparedPlayback })} disabled={disabled || state.preparing}>
            <option value="html-audio">HTML audio</option>
            <option value="web-audio">Web Audio</option>
          </select>
        </label>
        <button onClick={() => void prepare('static')} disabled={disabled || state.preparing}>Prepare static fixture</button>
        <button onClick={() => void prepare('live')} disabled={disabled || state.preparing || !LIVE_PROXY_URL} title={LIVE_PROXY_URL ? 'Generate through the configured server proxy' : 'Set VITE_TTS_PROXY_URL at build time'}>Prepare live fixture</button>
        <button className="primary" onClick={() => void simulateTransition()} disabled={disabled}>Simulate transition + play</button>
        <button className="danger" onClick={() => stop()} disabled={disabled}>Stop / Cancel</button>
        <button onClick={clearBuffer} disabled={disabled || !state.preparedForTransition}>Clear buffer</button>
      </div>
      <p className="speech-live-status" role="status">{status}</p>
      <p className="test-hint">Live proxy: {LIVE_PROXY_URL ? 'configured' : 'not configured (static experiment remains fully available)'}. A buffer is valid for exactly one numbered transition; late results and missed buffers are discarded.</p>
    </section>
  )
}
