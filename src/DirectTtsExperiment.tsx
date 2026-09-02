import { useCallback, useEffect, useRef, useState } from 'react'
import { CredentialVault, type CredentialIndicator } from './credentialVault'
import { db } from './db'
import {
  DIRECT_TTS_ENDPOINT,
  DIRECT_TTS_FIXTURE_ID,
  DIRECT_TTS_FORMAT,
  DIRECT_TTS_MODEL,
  DIRECT_TTS_VOICE,
  DirectTtsError,
  HtmlAudioSession,
  ObjectUrlLease,
  requestDirectSpeech,
  type SpeechResult,
} from './directTts'

interface Props {
  disabled: boolean
  recordEvent: (type: string, detail: string) => void
}

const vault = new CredentialVault({
  get: (id) => db.credentials.get(id),
  put: async (record) => { await db.credentials.put(record) },
  delete: async (id) => { await db.credentials.delete(id) },
})

interface PreparedSpeech {
  operation: number
  transition: number
  result: SpeechResult
}

function mode() {
  return window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
}

function rounded(value: number) {
  return Math.round(value)
}

export default function DirectTtsExperiment({ disabled, recordEvent }: Props) {
  const [indicator, setIndicator] = useState<CredentialIndicator>({ configured: false })
  const [editing, setEditing] = useState(true)
  const [status, setStatus] = useState('Credential status is loading.')
  const [busy, setBusy] = useState(false)
  const [preparedTransition, setPreparedTransition] = useState<number | null>(null)
  const operationRef = useRef(0)
  const transitionRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const preparedRef = useRef<PreparedSpeech | null>(null)
  const credentialInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlLeaseRef = useRef(new ObjectUrlLease(
    (blob) => URL.createObjectURL(blob),
    (url) => URL.revokeObjectURL(url),
  ))
  const audioSessionRef = useRef(new HtmlAudioSession(
    () => new Audio(),
    objectUrlLeaseRef.current,
  ))

  const log = useCallback((type: string, detail = '') => {
    const environment = `fixture=${DIRECT_TTS_FIXTURE_ID}; display=${mode()}; visibility=${document.visibilityState}; online=${navigator.onLine}`
    recordEvent(type, `${environment}${detail ? `; ${detail}` : ''}`)
  }, [recordEvent])

  const discardAudio = useCallback((reason: string, emit = true) => {
    audioSessionRef.current.stop()
    preparedRef.current = null
    setPreparedTransition(null)
    if (emit) log('direct-tts.cancelled', `reason=${reason}`)
  }, [log])

  const cancel = useCallback((reason: string, emit = true) => {
    operationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    discardAudio(reason, emit)
  }, [discardAudio])

  useEffect(() => {
    void vault.indicator().then((restored) => {
      setIndicator(restored)
      setEditing(!restored.configured)
      setStatus(restored.configured ? 'Saved key indicator restored. Full key remains hidden.' : 'No key configured on this device.')
    })
    const erased = () => {
      cancel('erase-all-data')
      setIndicator({ configured: false })
      setEditing(true)
      setStatus('All lab data and the saved key were erased.')
    }
    const reset = () => {
      cancel('run-reset')
      setStatus('Run reset; pending, prepared, and playing audio were discarded.')
    }
    window.addEventListener('lab-data-erased', erased)
    window.addEventListener('lab-run-reset', reset)
    return () => {
      window.removeEventListener('lab-data-erased', erased)
      window.removeEventListener('lab-run-reset', reset)
    }
  }, [cancel])

  useEffect(() => {
    const visibility = () => {
      log('direct-tts.visibility')
      if (document.hidden && (abortRef.current || audioSessionRef.current.active)) {
        cancel('backgrounded')
        setStatus('Cancelled when the page became hidden; no late result may play.')
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [cancel, log])

  useEffect(() => () => cancel('component-unmounted', false), [cancel])

  async function save() {
    try {
      const saved = await vault.save(credentialInputRef.current?.value ?? '')
      if (credentialInputRef.current) credentialInputRef.current.value = ''
      setIndicator(saved)
      setEditing(false)
      setStatus('Key saved in the dedicated device credential record; full value is hidden.')
      log('direct-tts.credential-saved', `lastFour=${saved.lastFour}`)
    } catch {
      setStatus('Enter a nonempty project API key.')
    }
  }

  async function remove() {
    cancel('credential-removed')
    await vault.remove()
    if (credentialInputRef.current) credentialInputRef.current.value = ''
    setIndicator({ configured: false })
    setEditing(true)
    setStatus('Key removed. Requests are disabled until another key is saved.')
    log('direct-tts.credential-removed')
  }

  async function play(result: SpeechResult, transition: number | null, transitionStartedAt?: number) {
    discardAudio('replacement', false)
    const assignedAt = performance.now()
    const transitionAt = transition === null ? null : (transitionStartedAt ?? assignedAt)
    log('direct-tts.playback-requested', transition === null ? '' : `transition=${transition}`)
    await audioSessionRef.current.play(result.blob, {
      ready: () => log('direct-tts.media-ready', `latencyMs=${rounded(performance.now() - assignedAt)}`),
      playing: () => {
        const latency = transitionAt === null ? performance.now() - assignedAt : performance.now() - transitionAt
        setStatus('MP3 is playing through HTMLAudioElement.')
        log('direct-tts.playing', `latencyMs=${rounded(latency)}${transition === null ? '' : `; transition=${transition}`}`)
      },
      ended: () => {
        setStatus('Playback ended; the object URL was revoked.')
        log('direct-tts.ended', transition === null ? '' : `transition=${transition}`)
      },
      interrupted: () => log('direct-tts.interrupted'),
      mediaFailed: () => {
        setStatus('Prepared MP3 failed in the media element.')
        log('direct-tts.failed', 'category=media')
      },
      playbackBlocked: () => {
        setStatus('Browser blocked or rejected playback.')
        log('direct-tts.failed', 'category=playback-blocked')
      },
    })
  }

  async function generate(targetTransition: number | null, playImmediately: boolean) {
    cancel('replacement', false)
    const operation = ++operationRef.current
    const abort = new AbortController()
    abortRef.current = abort
    setBusy(true)
    setStatus(targetTransition === null ? 'Making the direct authenticated request…' : `Preparing MP3 for transition ${targetTransition}…`)
    log('direct-tts.request-started', `operation=${operation}${targetTransition === null ? '' : `; targetTransition=${targetTransition}`}`)
    try {
      const result = await vault.withCredential((key) => requestDirectSpeech(key, abort.signal, undefined, (observation) => {
        log('direct-tts.fetch-resolved', `operation=${operation}; statusClass=${observation.statusClass}; contentType=${observation.contentType || 'not-provided'}; latencyMs=${rounded(observation.fetchResolvedMs)}`)
      }))
      log('direct-tts.response-complete', `operation=${operation}; bytes=${result.byteCount}; latencyMs=${rounded(result.completeMs)}`)
      if (operation !== operationRef.current || (targetTransition !== null && targetTransition <= transitionRef.current)) {
        log('direct-tts.skipped', `reason=stale-result; operation=${operation}${targetTransition === null ? '' : `; targetTransition=${targetTransition}`}`)
        setStatus('Late result rejected; it cannot play.')
        return
      }
      if (playImmediately) {
        await play(result, null)
      } else if (targetTransition !== null) {
        preparedRef.current = { operation, transition: targetTransition, result }
        setPreparedTransition(targetTransition)
        setStatus(`MP3 prepared for transition ${targetTransition}.`)
        log('direct-tts.prepared', `transition=${targetTransition}`)
      }
    } catch (error) {
      const category = error instanceof DirectTtsError
        ? error.category
        : error instanceof Error && error.message === 'credential-not-configured'
          ? 'authentication'
          : 'invalid-response'
      setStatus(category === 'cors-or-network'
        ? 'Fetch rejected before JavaScript could observe an HTTP response (cors-or-network).'
        : `Request did not produce playable audio (${category}).`)
      log(category === 'cancelled' ? 'direct-tts.cancelled' : category === 'offline' ? 'direct-tts.skipped' : 'direct-tts.failed', `category=${category}; operation=${operation}`)
    } finally {
      if (abortRef.current === abort) abortRef.current = null
      if (operation === operationRef.current) setBusy(false)
    }
  }

  async function transition() {
    const transitionId = ++transitionRef.current
    const transitionStartedAt = performance.now()
    const prepared = preparedRef.current
    log('direct-tts.transition', `transition=${transitionId}`)
    if (!prepared || prepared.transition !== transitionId) {
      preparedRef.current = null
      setPreparedTransition(null)
      setStatus(`Transition ${transitionId} skipped because no current MP3 was prepared.`)
      log('direct-tts.skipped', `reason=no-current-preparation; transition=${transitionId}`)
      return
    }
    preparedRef.current = null
    setPreparedTransition(null)
    await play(prepared.result, transitionId, transitionStartedAt)
  }

  function zeroPrepare() {
    const target = transitionRef.current + 1
    void generate(target, false)
    window.setTimeout(() => {
      void transition()
    }, 0)
  }

  return (
    <section className="speech-panel direct-tts-panel" aria-labelledby="direct-tts-heading">
      <div className="speech-heading">
        <div>
          <p className="section-label">RL-SPE-25–33 direct-browser gate</p>
          <h2 id="direct-tts-heading">OpenAI MP3 through HTMLAudioElement</h2>
        </div>
        <dl className="speech-status">
          <div><dt>Key</dt><dd>{indicator.configured ? `configured ····${indicator.lastFour}` : 'not configured'}</dd></div>
          <div><dt>Transition</dt><dd>{transitionRef.current}</dd></div>
          <div><dt>Prepared</dt><dd>{preparedTransition ?? 'none'}</dd></div>
        </dl>
      </div>

      <div className="warning">
        <strong>Owner setup before testing:</strong> use a dedicated OpenAI project and project key (never an admin key), restrict its model allowlist to <code>{DIRECT_TTS_MODEL}</code> where available, set a small hard project spend limit and a lower alert, then revoke the key after testing. The lab cannot verify these settings. Client-side storage is an accepted experiment exception, not a generally secure or OpenAI-recommended pattern.
      </div>

      <dl className="request-contract">
        <div><dt>Endpoint</dt><dd><code>{DIRECT_TTS_ENDPOINT}</code></dd></div>
        <div><dt>Model</dt><dd><code>{DIRECT_TTS_MODEL}</code></dd></div>
        <div><dt>Voice / format</dt><dd><code>{DIRECT_TTS_VOICE}</code> / <code>{DIRECT_TTS_FORMAT}</code></dd></div>
        <div><dt>Fixture</dt><dd><code>{DIRECT_TTS_FIXTURE_ID}</code></dd></div>
      </dl>

      {editing && (
        <label className="credential-entry">Project API key
          <input ref={credentialInputRef} type="password" autoComplete="off" spellCheck={false} placeholder="Enter manually on this iPhone" disabled={disabled} />
        </label>
      )}
      <div className="speech-controls">
        {editing && <button onClick={() => void save()} disabled={disabled}>Save on this device</button>}
        {indicator.configured && <button onClick={() => { cancel('key-replacement'); setEditing(true); if (credentialInputRef.current) credentialInputRef.current.value = '' }} disabled={disabled}>Replace key</button>}
        {indicator.configured && <button className="danger" onClick={() => void remove()} disabled={disabled}>Remove key</button>}
        <button className="primary" onClick={() => void generate(null, true)} disabled={disabled || busy || !indicator.configured}>Test speech</button>
        <button onClick={() => void generate(transitionRef.current + 1, false)} disabled={disabled || busy || !indicator.configured}>Prepare next transition</button>
        <button onClick={() => void transition()} disabled={disabled}>Simulate transition</button>
        <button onClick={zeroPrepare} disabled={disabled || busy || !indicator.configured}>Zero-second Prepare</button>
        <button className="danger" onClick={() => { cancel('tester-cancelled'); setStatus('Cancelled; pending and prepared audio were discarded.') }} disabled={disabled}>Cancel / discard</button>
      </div>
      <p className="speech-live-status" role="status">{status}</p>
      <p className="test-hint">Every paid request begins only with a tester tap. A browser TypeError without an observable response is recorded as <code>cors-or-network</code>; the lab does not infer that CORS was uniquely responsible.</p>
    </section>
  )
}
