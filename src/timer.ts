export type TimerStatus = 'idle' | 'running' | 'paused' | 'complete'

export interface PhaseDefinition {
  name: string
  durationMs: number
}

export interface TimerProjection {
  status: TimerStatus
  elapsedMs: number
  phaseIndex: number
  phase: string
  phaseRemainingMs: number
  displaySeconds: number
}

export const TIMELINE: PhaseDefinition[] = [
  { name: 'Prepare', durationMs: 5_000 },
  { name: 'Work', durationMs: 8_000 },
  { name: 'Rest', durationMs: 4_000 },
  { name: 'Work', durationMs: 8_000 },
  { name: 'Cooldown', durationMs: 3_000 },
]

export const TOTAL_DURATION_MS = TIMELINE.reduce(
  (total, phase) => total + phase.durationMs,
  0,
)

export function projectTimer(
  elapsedMs: number,
  status: TimerStatus,
): TimerProjection {
  const elapsed = Math.min(Math.max(elapsedMs, 0), TOTAL_DURATION_MS)

  if (status === 'complete' || elapsed >= TOTAL_DURATION_MS) {
    return {
      status: 'complete',
      elapsedMs: TOTAL_DURATION_MS,
      phaseIndex: TIMELINE.length,
      phase: 'Complete',
      phaseRemainingMs: 0,
      displaySeconds: 0,
    }
  }

  let phaseStart = 0
  for (const [phaseIndex, phase] of TIMELINE.entries()) {
    const phaseEnd = phaseStart + phase.durationMs
    if (elapsed < phaseEnd) {
      const phaseRemainingMs = phaseEnd - elapsed
      return {
        status,
        elapsedMs: elapsed,
        phaseIndex,
        phase: phase.name,
        phaseRemainingMs,
        displaySeconds: Math.ceil(phaseRemainingMs / 1_000),
      }
    }
    phaseStart = phaseEnd
  }

  return projectTimer(TOTAL_DURATION_MS, 'complete')
}
