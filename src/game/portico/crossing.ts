export type CrossingDirection = 'frontToBack' | 'backToFront'
export type CrossingStatus = 'none' | 'partial' | 'reversed' | 'valid'

export type CrossingState = {
  restingSide: 'front' | 'back' | null
  trackingDirection: CrossingDirection | null
  invalidSideEntry: boolean
}

export type CrossingInput = {
  minimumAlongNormal: number
  maximumAlongNormal: number
  withinOpening: boolean
}

export type CrossingResult = {
  status: CrossingStatus
  direction: CrossingDirection | null
}

export const createCrossingState = (): CrossingState => ({
  restingSide: null,
  trackingDirection: null,
  invalidSideEntry: false,
})

export const createCrossingResult = (): CrossingResult => ({
  status: 'none',
  direction: null,
})

const setResult = (
  output: CrossingResult,
  status: CrossingStatus,
  direction: CrossingDirection | null = null,
): CrossingResult => {
  output.status = status
  output.direction = direction
  return output
}

export const stepCrossing = (
  state: CrossingState,
  input: CrossingInput,
  triggerOffset: number,
  output: CrossingResult,
): CrossingResult => {
  const offset = Math.max(0, triggerOffset)
  const entirelyFront = input.maximumAlongNormal <= -offset
  const entirelyBack = input.minimumAlongNormal >= offset
  const clearSide = entirelyFront ? 'front' : entirelyBack ? 'back' : null

  setResult(output, 'none')

  if (!input.withinOpening) {
    state.trackingDirection = null
    if (clearSide === null) {
      state.invalidSideEntry = true
      state.restingSide = null
    } else {
      state.invalidSideEntry = false
      state.restingSide = clearSide
    }
    return output
  }

  if (state.invalidSideEntry) {
    if (clearSide !== null) {
      state.invalidSideEntry = false
      state.restingSide = clearSide
    }
    return output
  }

  if (state.trackingDirection === null) {
    if (state.restingSide === null) {
      if (clearSide === null) state.invalidSideEntry = true
      else state.restingSide = clearSide
      return output
    }

    if (clearSide === state.restingSide) return output

    const direction: CrossingDirection =
      state.restingSide === 'front' ? 'frontToBack' : 'backToFront'
    if (clearSide !== null) {
      state.restingSide = clearSide
      return setResult(output, 'valid', direction)
    }

    state.trackingDirection = direction
    return setResult(output, 'partial', direction)
  }

  const direction = state.trackingDirection
  const originSide = direction === 'frontToBack' ? 'front' : 'back'
  const destinationSide = originSide === 'front' ? 'back' : 'front'

  if (clearSide === originSide) {
    state.trackingDirection = null
    state.restingSide = originSide
    return setResult(output, 'reversed', direction)
  }
  if (clearSide === destinationSide) {
    state.trackingDirection = null
    state.restingSide = destinationSide
    return setResult(output, 'valid', direction)
  }
  return setResult(output, 'partial', direction)
}
