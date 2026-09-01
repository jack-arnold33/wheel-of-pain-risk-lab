export type PreparedPlayback = 'html-audio' | 'web-audio'

export interface SpeechState {
  operationId: number
  transitionId: number
  preparing: boolean
  preparedForTransition: number | null
  preparedSource: 'static' | 'live' | null
  playback: PreparedPlayback
}

export type SpeechAction =
  | { type: 'prepare-request'; operationId: number; targetTransition: number }
  | { type: 'prepare-success'; operationId: number; targetTransition: number; source: 'static' | 'live' }
  | { type: 'cancel'; operationId: number }
  | { type: 'clear' }
  | { type: 'select-playback'; playback: PreparedPlayback }
  | { type: 'transition'; transitionId: number }
  | { type: 'consume'; transitionId: number }

export const initialSpeechState: SpeechState = {
  operationId: 0,
  transitionId: 0,
  preparing: false,
  preparedForTransition: null,
  preparedSource: null,
  playback: 'html-audio',
}

export function speechReducer(state: SpeechState, action: SpeechAction): SpeechState {
  switch (action.type) {
    case 'prepare-request':
      return {
        ...state,
        operationId: action.operationId,
        preparing: true,
        preparedForTransition: null,
        preparedSource: null,
      }
    case 'prepare-success':
      if (
        action.operationId !== state.operationId
        || action.targetTransition <= state.transitionId
      ) return state
      return {
        ...state,
        preparing: false,
        preparedForTransition: action.targetTransition,
        preparedSource: action.source,
      }
    case 'cancel':
      return {
        ...state,
        operationId: action.operationId,
        preparing: false,
        preparedForTransition: null,
        preparedSource: null,
      }
    case 'clear':
      return { ...state, preparedForTransition: null, preparedSource: null }
    case 'select-playback':
      return { ...state, playback: action.playback }
    case 'transition':
      return {
        ...state,
        transitionId: action.transitionId,
        preparing: false,
        preparedForTransition:
          state.preparedForTransition === action.transitionId
            ? state.preparedForTransition
            : null,
        preparedSource:
          state.preparedForTransition === action.transitionId
            ? state.preparedSource
            : null,
      }
    case 'consume':
      if (state.preparedForTransition !== action.transitionId) return state
      return { ...state, preparedForTransition: null, preparedSource: null }
  }
}

export function canPlayAtTransition(state: SpeechState, transitionId: number) {
  return state.preparedForTransition === transitionId
}
