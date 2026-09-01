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
  | 'RL-SPE-09'
  | 'RL-SPE-10'
  | 'RL-SPE-11'
  | 'RL-SPE-12'
  | 'RL-SPE-13'
  | 'RL-SPE-14'
  | 'RL-SPE-15'
  | 'RL-SPE-16'
  | 'RL-SPE-17'
  | 'RL-SPE-18'
  | 'RL-SPE-19'
  | 'RL-SPE-20'
  | 'RL-SPE-21'
  | 'RL-SPE-22'
  | 'RL-SPE-23'
  | 'RL-SPE-24'

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
  receiverModel?: string
  routingConfiguration?: string
  musicPlaying?: string
  outputDestination?: string
  audibleDelay?: string
  interruptions?: string
  notes?: string
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
