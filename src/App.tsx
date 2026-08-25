import { useCallback, useEffect, useRef, useState } from 'react'
import { db, type LabEvent, type LabRun, type Verdict } from './db'
import {
  projectTimer,
  TOTAL_DURATION_MS,
  type TimerProjection,
  type TimerStatus,
} from './timer'

const CALLBACK_DELAY_MS = 10_000

interface LiveTimer {
  status: TimerStatus
  baseElapsedMs: number
  anchorMonotonicMs: number
}

interface EnvironmentForm {
  deviceModel: string
  osVersion: string
  browser: string
  launchMode: 'browser_tab' | 'home_screen'
}

function detectDisplayMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    ? 'standalone'
    : 'browser'
}

function initialProjection(): TimerProjection {
  return projectTimer(0, 'idle')
}

function App() {
  const [environment, setEnvironment] = useState<EnvironmentForm>({
    deviceModel: 'iPhone 15',
    osVersion: '26.6',
    browser: 'Safari',
    launchMode: 'browser_tab',
  })
  const [selectedCase, setSelectedCase] = useState<'RL-TIM-01' | 'RL-TIM-02'>('RL-TIM-01')
  const [projection, setProjection] = useState<TimerProjection>(initialProjection)
  const [events, setEvents] = useState<LabEvent[]>([])
  const [activeRun, setActiveRun] = useState<LabRun | null>(null)
  const [completedRuns, setCompletedRuns] = useState<LabRun[]>([])
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null)
  const [warning, setWarning] = useState('')
  const [storageState, setStorageState] = useState('opening')
  const [serviceWorkerState, setServiceWorkerState] = useState('checking')
  const [isInjectingDelay, setIsInjectingDelay] = useState(false)

  const timerRef = useRef<LiveTimer>({
    status: 'idle',
    baseElapsedMs: 0,
    anchorMonotonicMs: 0,
  })
  const runIdRef = useRef<string | null>(null)
  const sequenceRef = useRef(0)
  const lastPhaseRef = useRef(-1)
  const lastCallbackSecondRef = useRef(-1)
  const restoreStartedRef = useRef(false)

  const refreshCompletedRuns = useCallback(async () => {
    const runs = await db.runs
      .orderBy('startedAt')
      .reverse()
      .filter((run) => Boolean(run.endedAt))
      .limit(6)
      .toArray()
    setCompletedRuns(runs)
  }, [])

  const elapsedNow = useCallback((now = performance.now()) => {
    const timer = timerRef.current
    if (timer.status !== 'running') return timer.baseElapsedMs
    return Math.min(
      timer.baseElapsedMs + (now - timer.anchorMonotonicMs),
      TOTAL_DURATION_MS,
    )
  }, [])

  const recordEvent = useCallback((type: string, detail: string) => {
    const runId = runIdRef.current
    if (!runId) return

    const event: LabEvent = {
      runId,
      sequence: ++sequenceRef.current,
      type,
      wallTime: new Date().toISOString(),
      monotonicMs: Math.round(performance.now()),
      detail,
    }
    setEvents((current) => [...current, event])
    void db.events.add(event).catch((error) => {
      setStorageState(`write failed: ${String(error)}`)
    })
  }, [])

  const saveCheckpoint = useCallback(async (
    status: Exclude<TimerStatus, 'idle'>,
    elapsedMs: number,
  ) => {
    const runId = runIdRef.current
    if (!runId) return
    await db.checkpoints.put({
      key: 'rl-tim',
      runId,
      status,
      elapsedMs,
      savedAtWallMs: Date.now(),
    })
    recordEvent('timer.checkpoint', `${status} at ${Math.round(elapsedMs)} ms`)
  }, [recordEvent])

  const renderCurrent = useCallback((now = performance.now()) => {
    const elapsed = elapsedNow(now)
    const next = projectTimer(elapsed, timerRef.current.status)

    if (next.status === 'complete' && timerRef.current.status !== 'complete') {
      timerRef.current = {
        status: 'complete',
        baseElapsedMs: TOTAL_DURATION_MS,
        anchorMonotonicMs: now,
      }
      recordEvent('timer.complete', 'Timeline reached Complete')
      void saveCheckpoint('complete', TOTAL_DURATION_MS)
    }

    if (next.phaseIndex !== lastPhaseRef.current) {
      lastPhaseRef.current = next.phaseIndex
      recordEvent('timer.phase', `${next.phase}; ${next.displaySeconds}s remaining`)
    }

    setProjection(next)
  }, [elapsedNow, recordEvent, saveCheckpoint])

  useEffect(() => {
    if (restoreStartedRef.current) return
    restoreStartedRef.current = true
    let cancelled = false
    async function restore() {
      try {
        await db.open()
        if (cancelled) return
        setStorageState('ready')
        await refreshCompletedRuns()
        const checkpoint = await db.checkpoints.get('rl-tim')
        if (!checkpoint) return
        const run = await db.runs.get(checkpoint.runId)
        if (!run || run.endedAt) return

        const savedEvents = await db.events.where('runId').equals(run.id).sortBy('sequence')
        const wallDelta = Date.now() - checkpoint.savedAtWallMs
        let status = checkpoint.status
        let elapsedMs = checkpoint.elapsedMs

        if (status === 'running') {
          if (wallDelta < 0) {
            status = 'paused'
            setWarning('Wall clock moved backward. Restored Paused; timing accuracy is uncertain.')
          } else {
            elapsedMs = Math.min(elapsedMs + wallDelta, TOTAL_DURATION_MS)
            if (elapsedMs >= TOTAL_DURATION_MS) status = 'complete'
          }
        }

        runIdRef.current = run.id
        sequenceRef.current = savedEvents.at(-1)?.sequence ?? 0
        timerRef.current = {
          status,
          baseElapsedMs: elapsedMs,
          anchorMonotonicMs: performance.now(),
        }
        setActiveRun(run)
        setSelectedCase(run.caseId)
        setEnvironment({
          deviceModel: run.deviceModel,
          osVersion: run.osVersion,
          browser: run.browser,
          launchMode: run.launchMode as EnvironmentForm['launchMode'],
        })
        setEvents(savedEvents)
        setProjection(projectTimer(elapsedMs, status))
        recordEvent('timer.recovered', `${status} at ${Math.round(elapsedMs)} ms`)
      } catch (error) {
        setStorageState(`open failed: ${String(error)}`)
      }
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [recordEvent, refreshCompletedRuns])

  useEffect(() => {
    const listener = (event: Event) => {
      setServiceWorkerState((event as CustomEvent<string>).detail)
    }
    window.addEventListener('risk-lab-sw-state', listener)
    return () => window.removeEventListener('risk-lab-sw-state', listener)
  }, [])

  useEffect(() => {
    if (projection.status !== 'running') return
    const interval = window.setInterval(() => {
      const second = Math.floor(elapsedNow() / 1_000)
      if (second !== lastCallbackSecondRef.current) {
        lastCallbackSecondRef.current = second
        recordEvent('timer.callback', `elapsed ${second}s`)
      }
      renderCurrent()
    }, 100)
    return () => window.clearInterval(interval)
  }, [elapsedNow, projection.status, recordEvent, renderCurrent])

  useEffect(() => {
    if (resumeCountdown === null) return
    const timeout = window.setTimeout(() => {
      if (resumeCountdown > 1) {
        setResumeCountdown(resumeCountdown - 1)
        return
      }
      timerRef.current = {
        status: 'running',
        baseElapsedMs: timerRef.current.baseElapsedMs,
        anchorMonotonicMs: performance.now(),
      }
      setResumeCountdown(null)
      setProjection(projectTimer(timerRef.current.baseElapsedMs, 'running'))
      recordEvent('timer.resumed', 'Resume countdown completed')
      void saveCheckpoint('running', timerRef.current.baseElapsedMs)
    }, 1_000)
    return () => window.clearTimeout(timeout)
  }, [recordEvent, resumeCountdown, saveCheckpoint])

  useEffect(() => {
    const onVisibilityChange = () => {
      recordEvent('lifecycle.visibility', document.visibilityState)
      if (document.hidden && resumeCountdown !== null) {
        setResumeCountdown(null)
        recordEvent('resume.interrupted', 'Visibility changed during countdown')
      }
      if (document.hidden && timerRef.current.status === 'running') {
        const elapsed = elapsedNow()
        timerRef.current.baseElapsedMs = elapsed
        timerRef.current.anchorMonotonicMs = performance.now()
        void saveCheckpoint('running', elapsed)
      }
      if (!document.hidden) renderCurrent()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [elapsedNow, recordEvent, renderCurrent, resumeCountdown, saveCheckpoint])

  async function startRun() {
    const id = crypto.randomUUID()
    const run: LabRun = {
      id,
      caseId: selectedCase,
      buildId: __LAB_BUILD__,
      ...environment,
      startedAt: new Date().toISOString(),
    }
    await db.runs.add(run)
    runIdRef.current = id
    sequenceRef.current = 0
    lastPhaseRef.current = -1
    lastCallbackSecondRef.current = -1
    timerRef.current = {
      status: 'running',
      baseElapsedMs: 0,
      anchorMonotonicMs: performance.now(),
    }
    setWarning('')
    setEvents([])
    setActiveRun(run)
    setProjection(projectTimer(0, 'running'))
    recordEvent('run.started', `${selectedCase}; detected display mode ${detectDisplayMode()}`)
    await saveCheckpoint('running', 0)
  }

  function pauseTimer() {
    if (timerRef.current.status !== 'running') return
    const elapsed = elapsedNow()
    timerRef.current = {
      status: 'paused',
      baseElapsedMs: elapsed,
      anchorMonotonicMs: performance.now(),
    }
    setProjection(projectTimer(elapsed, 'paused'))
    recordEvent('timer.paused', `${Math.round(elapsed)} ms`)
    void saveCheckpoint('paused', elapsed)
  }

  function beginResume() {
    if (timerRef.current.status !== 'paused') return
    setResumeCountdown(3)
    recordEvent('resume.started', '3 second countdown')
  }

  function injectDelay() {
    if (timerRef.current.status !== 'running' || isInjectingDelay) return
    setIsInjectingDelay(true)
    recordEvent('fault.armed', `${CALLBACK_DELAY_MS} ms main-thread delay`)
    window.setTimeout(() => {
      const started = performance.now()
      recordEvent('fault.started', `elapsed ${Math.round(elapsedNow(started))} ms`)
      while (performance.now() - started < CALLBACK_DELAY_MS) {
        // Intentional RL-TIM-02 main-thread block.
      }
      const ended = performance.now()
      recordEvent('fault.ended', `actual delay ${Math.round(ended - started)} ms`)
      setIsInjectingDelay(false)
      renderCurrent(ended)
    }, 100)
  }

  function markObservation() {
    recordEvent(
      'observation.marked',
      `${projection.status}; ${projection.phase}; ${projection.displaySeconds}s remaining`,
    )
  }

  async function endRun() {
    if (!activeRun) return
    const endedElapsed = elapsedNow()
    const endedAt = new Date().toISOString()
    const updated = { ...activeRun, endedAt }
    await db.runs.put(updated)
    recordEvent('run.ended', 'Ended; awaiting tester verdict')
    setActiveRun(updated)
    const endedStatus = projection.status === 'complete' ? 'complete' : 'paused'
    timerRef.current = {
      status: endedStatus,
      baseElapsedMs: endedElapsed,
      anchorMonotonicMs: performance.now(),
    }
    setProjection(projectTimer(endedElapsed, endedStatus))
    await db.checkpoints.delete('rl-tim')
    await refreshCompletedRuns()
  }

  async function classifyRun(verdict: Verdict) {
    if (!activeRun) return
    const updated = { ...activeRun, verdict }
    await db.runs.put(updated)
    recordEvent('run.verdict', verdict)
    setActiveRun(updated)
    await refreshCompletedRuns()
  }

  async function resetTimer() {
    const run = activeRun
    if (run && !run.endedAt) {
      await db.transaction('rw', db.runs, db.events, db.checkpoints, async () => {
        await db.events.where('runId').equals(run.id).delete()
        await db.runs.delete(run.id)
        await db.checkpoints.delete('rl-tim')
      })
    } else {
      await db.checkpoints.delete('rl-tim')
    }
    runIdRef.current = null
    sequenceRef.current = 0
    timerRef.current = { status: 'idle', baseElapsedMs: 0, anchorMonotonicMs: 0 }
    setActiveRun(null)
    setEvents([])
    setProjection(initialProjection())
    setResumeCountdown(null)
    setWarning('')
  }

  async function exportRun() {
    if (!activeRun) return
    const storedEvents = await db.events.where('runId').equals(activeRun.id).sortBy('sequence')
    const report = {
      exportedAt: new Date().toISOString(),
      labVersion: '0.1.0',
      sourceCommit: __LAB_BUILD__,
      run: activeRun,
      environment: {
        online: navigator.onLine,
        detectedDisplayMode: detectDisplayMode(),
        userAgent: navigator.userAgent,
      },
      expected: selectedCase === 'RL-TIM-01'
        ? 'Correct sequence without zero linger or callback drift.'
        : 'First render catches up after a controlled callback delay.',
      events: storedEvents,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${activeRun.caseId}_${activeRun.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function openStoredRun(run: LabRun) {
    const storedEvents = await db.events.where('runId').equals(run.id).sortBy('sequence')
    runIdRef.current = run.id
    sequenceRef.current = storedEvents.at(-1)?.sequence ?? 0
    setActiveRun(run)
    setSelectedCase(run.caseId)
    setEnvironment({
      deviceModel: run.deviceModel,
      osVersion: run.osVersion,
      browser: run.browser,
      launchMode: run.launchMode as EnvironmentForm['launchMode'],
    })
    setEvents(storedEvents)
    timerRef.current = { status: 'idle', baseElapsedMs: 0, anchorMonotonicMs: 0 }
    setProjection(initialProjection())
  }

  async function eraseAllData() {
    if (!window.confirm('Erase every risk-lab run, event, and checkpoint on this device?')) return
    await db.transaction('rw', db.runs, db.events, db.checkpoints, async () => {
      await Promise.all([db.runs.clear(), db.events.clear(), db.checkpoints.clear()])
    })
    setCompletedRuns([])
    await resetTimer()
  }

  const controlsDisabled = !activeRun || Boolean(activeRun.endedAt)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Disposable PWA risk lab</p>
          <h1>Wheel of Pain Risk Lab</h1>
          <p className="subtitle">RL-TIM foreground timing and callback-delay smoke test</p>
        </div>
        <dl className="status-strip">
          <div><dt>Build</dt><dd>{__LAB_BUILD__.slice(0, 8)}</dd></div>
          <div><dt>Network</dt><dd>{navigator.onLine ? 'online' : 'offline'}</dd></div>
          <div><dt>Display</dt><dd>{detectDisplayMode()}</dd></div>
          <div><dt>Storage</dt><dd>{storageState}</dd></div>
          <div><dt>Worker</dt><dd>{serviceWorkerState}</dd></div>
        </dl>
      </header>

      {warning && <div className="warning" role="alert">{warning}</div>}

      <section className="setup-panel" aria-labelledby="setup-heading">
        <div>
          <p className="section-label">Setup</p>
          <h2 id="setup-heading">Environment and case</h2>
        </div>
        <div className="setup-grid">
          <label>Device<input value={environment.deviceModel} onChange={(event) => setEnvironment({ ...environment, deviceModel: event.target.value })} disabled={Boolean(activeRun)} /></label>
          <label>iOS<input value={environment.osVersion} onChange={(event) => setEnvironment({ ...environment, osVersion: event.target.value })} disabled={Boolean(activeRun)} /></label>
          <label>Browser<input value={environment.browser} onChange={(event) => setEnvironment({ ...environment, browser: event.target.value })} disabled={Boolean(activeRun)} /></label>
          <label>Launch mode<select value={environment.launchMode} onChange={(event) => setEnvironment({ ...environment, launchMode: event.target.value as EnvironmentForm['launchMode'] })} disabled={Boolean(activeRun)}><option value="browser_tab">Browser tab</option><option value="home_screen">Home Screen</option></select></label>
          <label>Case<select value={selectedCase} onChange={(event) => setSelectedCase(event.target.value as typeof selectedCase)} disabled={Boolean(activeRun)}><option value="RL-TIM-01">RL-TIM-01 · foreground</option><option value="RL-TIM-02">RL-TIM-02 · callback delay</option></select></label>
        </div>
      </section>

      <section className="timer-panel" aria-label="Timer smoke test">
        <div className="timer-readout">
          <p className="section-label">Observed state</p>
          <p className="phase">{projection.phase}</p>
          <p className="remaining" aria-label={`${projection.displaySeconds} seconds remaining`}>
            {projection.displaySeconds}
          </p>
          <p className="timer-meta">
            {projection.status} · {(projection.elapsedMs / 1_000).toFixed(1)}s / 28.0s
          </p>
          {resumeCountdown !== null && (
            <div className="countdown" role="status">Resuming in {resumeCountdown}</div>
          )}
        </div>

        <div className="controls">
          {!activeRun && <button className="primary" onClick={() => void startRun()}>Start run</button>}
          <button onClick={pauseTimer} disabled={controlsDisabled || projection.status !== 'running'}>Pause</button>
          <button onClick={beginResume} disabled={controlsDisabled || projection.status !== 'paused' || resumeCountdown !== null}>Resume</button>
          <button className="danger" onClick={injectDelay} disabled={controlsDisabled || projection.status !== 'running' || isInjectingDelay}>
            {isInjectingDelay ? 'Delay running…' : 'Inject 10s delay'}
          </button>
          <button onClick={markObservation} disabled={controlsDisabled}>Mark observation</button>
          <button onClick={() => void endRun()} disabled={controlsDisabled}>End run</button>
          <button onClick={() => void exportRun()} disabled={!activeRun}>Export JSON</button>
          <button onClick={() => void resetTimer()}>Reset RL-TIM</button>
        </div>

        <p className="test-hint">
          For RL-TIM-02, start the run and inject the delay during Prepare. The page will
          intentionally stop responding for ten seconds; the next render should catch up.
        </p>
      </section>

      <section className="evidence-panel" aria-labelledby="evidence-heading">
        <div className="evidence-heading">
          <div>
            <p className="section-label">Local evidence</p>
            <h2 id="evidence-heading">Recent events</h2>
          </div>
          <div className="verdicts" aria-label="Assign verdict">
            {(['Pass', 'Fail', 'Inconclusive', 'Not Supported'] as Verdict[]).map((verdict) => (
              <button key={verdict} onClick={() => void classifyRun(verdict)} disabled={!activeRun?.endedAt || Boolean(activeRun.verdict)}>
                {verdict}
              </button>
            ))}
          </div>
        </div>

        <ol className="event-log">
          {events.slice(-14).reverse().map((event) => (
            <li key={`${event.sequence}-${event.type}`}>
              <span className="event-sequence">#{event.sequence}</span>
              <span className="event-type">{event.type}</span>
              <span className="event-detail">{event.detail}</span>
              <time>{new Date(event.wallTime).toLocaleTimeString()}</time>
            </li>
          ))}
          {events.length === 0 && <li className="empty-log">Start a run to record local evidence.</li>}
        </ol>

        <div className="stored-runs">
          <div>
            <h3>Stored completed runs</h3>
            <p>Kept locally until all lab data is explicitly erased.</p>
          </div>
          <div className="stored-run-list">
            {completedRuns.map((run) => (
              <button key={run.id} onClick={() => void openStoredRun(run)}>
                {run.caseId} · {run.verdict ?? 'unclassified'} · {new Date(run.startedAt).toLocaleString()}
              </button>
            ))}
            {completedRuns.length === 0 && <span>No completed runs yet.</span>}
          </div>
          <button className="danger" onClick={() => void eraseAllData()} disabled={storageState !== 'ready'}>
            Erase all lab data
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
