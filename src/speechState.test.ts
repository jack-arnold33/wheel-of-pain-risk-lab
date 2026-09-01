import { describe, expect, it } from 'vitest'
import { canPlayAtTransition, initialSpeechState, speechReducer } from './speechState'

describe('speech experiment state', () => {
  it('selects the requested playback path', () => {
    const state = speechReducer(initialSpeechState, {
      type: 'select-playback',
      playback: 'web-audio',
    })
    expect(state.playback).toBe('web-audio')
  })

  it('cancels an in-flight preparation and clears its buffer', () => {
    const preparing = speechReducer(initialSpeechState, {
      type: 'prepare-request', operationId: 1, targetTransition: 1,
    })
    const cancelled = speechReducer(preparing, { type: 'cancel', operationId: 2 })
    const late = speechReducer(cancelled, {
      type: 'prepare-success', operationId: 1, targetTransition: 1, source: 'live',
    })
    expect(late.preparing).toBe(false)
    expect(late.preparedForTransition).toBeNull()
  })

  it('rejects a result that arrives after its intended transition', () => {
    const preparing = speechReducer(initialSpeechState, {
      type: 'prepare-request', operationId: 1, targetTransition: 1,
    })
    const transitioned = speechReducer(preparing, { type: 'transition', transitionId: 1 })
    const late = speechReducer(transitioned, {
      type: 'prepare-success', operationId: 1, targetTransition: 1, source: 'live',
    })
    expect(canPlayAtTransition(late, 1)).toBe(false)
  })

  it('allows one exact transition then consumes the buffer', () => {
    const preparing = speechReducer(initialSpeechState, {
      type: 'prepare-request', operationId: 1, targetTransition: 1,
    })
    const prepared = speechReducer(preparing, {
      type: 'prepare-success', operationId: 1, targetTransition: 1, source: 'static',
    })
    const transitioned = speechReducer(prepared, { type: 'transition', transitionId: 1 })
    expect(canPlayAtTransition(transitioned, 1)).toBe(true)
    expect(speechReducer(transitioned, { type: 'consume', transitionId: 1 }).preparedForTransition).toBeNull()
  })
})
