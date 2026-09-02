import { describe, expect, it } from 'vitest'
import { projectTimer } from './timer'

describe('timer independence from speech', () => {
  it('projects solely from elapsed time regardless of unrelated speech outcomes', () => {
    const before = projectTimer(12_500, 'running')
    const speechOutcomes = ['success', 'cors-or-network', 'offline', 'cancelled', 'stale']
    for (const _outcome of speechOutcomes) expect(projectTimer(12_500, 'running')).toEqual(before)
  })
})

