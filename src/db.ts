import Dexie, { type Table } from 'dexie'
import type { TimerStatus } from './timer'

export type Verdict = 'Pass' | 'Fail' | 'Inconclusive' | 'Not Supported'

export type LabCaseId =
  | 'RL-TIM-01'
  | 'RL-TIM-02'
  | 'RL-WAK-01'
  | 'RL-WAK-02'
  | 'RL-WAK-03'
  | 'RL-WAK-04'
  | 'RL-WAK-05'

export interface LabRun {
  id: string
  caseId: LabCaseId
  buildId: string
  deviceModel: string
  osVersion: string
  browser: string
  launchMode: string
  autoLock?: string
  lowPowerMode?: string
  mirroring?: string
  startedAt: string
  endedAt?: string
  verdict?: Verdict
}

export interface LabEvent {
  id?: number
  runId: string
  sequence: number
  type: string
  wallTime: string
  monotonicMs: number
  detail: string
}

export interface TimerCheckpoint {
  key: 'rl-tim'
  runId: string
  status: Exclude<TimerStatus, 'idle'>
  elapsedMs: number
  savedAtWallMs: number
}

class RiskLabDatabase extends Dexie {
  runs!: Table<LabRun, string>
  events!: Table<LabEvent, number>
  checkpoints!: Table<TimerCheckpoint, string>

  constructor() {
    super('wheel-of-pain-risk-lab')
    this.version(1).stores({
      runs: 'id, caseId, startedAt, verdict',
      events: '++id, runId, sequence, type',
      checkpoints: 'key, runId, status',
    })
  }
}

export const db = new RiskLabDatabase()
