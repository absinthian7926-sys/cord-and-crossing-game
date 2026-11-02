import { describe, expect, it } from 'vitest'
import {
  createCrossingResult,
  createCrossingState,
  stepCrossing,
  type CrossingInput,
  type CrossingResult,
  type CrossingState,
} from '../game/portico/crossing'

const OFFSET = 0.3
const front: CrossingInput = {
  minimumAlongNormal: -1,
  maximumAlongNormal: -0.4,
  withinOpening: true,
}
const middle: CrossingInput = {
  minimumAlongNormal: -0.2,
  maximumAlongNormal: 0.2,
  withinOpening: true,
}
const back: CrossingInput = {
  minimumAlongNormal: 0.4,
  maximumAlongNormal: 1,
  withinOpening: true,
}

const step = (
  state: CrossingState,
  output: CrossingResult,
  input: CrossingInput,
) => stepCrossing(state, input, OFFSET, output)

describe('full portico crossing detector', () => {
  it('detects a valid front-to-back crossing only after the capsule clears B', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    expect(step(state, output, front)).toEqual({
      status: 'none',
      direction: null,
    })
    expect(step(state, output, middle)).toEqual({
      status: 'partial',
      direction: 'frontToBack',
    })
    expect(step(state, output, back)).toEqual({
      status: 'valid',
      direction: 'frontToBack',
    })
  })

  it('detects a valid back-to-front crossing', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, back)
    expect(step(state, output, middle)).toEqual({
      status: 'partial',
      direction: 'backToFront',
    })
    expect(step(state, output, front)).toEqual({
      status: 'valid',
      direction: 'backToFront',
    })
  })

  it('reports a stopped capsule as partial without granting an effect', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, front)
    expect(step(state, output, middle).status).toBe('partial')
    expect(step(state, output, middle).status).toBe('partial')
  })

  it('reports reversing midway and keeps the original direction', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, front)
    step(state, output, middle)
    expect(step(state, output, front)).toEqual({
      status: 'reversed',
      direction: 'frontToBack',
    })
  })

  it('rejects side entry until the capsule fully clears a side', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    expect(step(state, output, middle).status).toBe('none')
    expect(step(state, output, middle).status).toBe('none')
    expect(step(state, output, back).status).toBe('none')
    expect(step(state, output, middle).status).toBe('partial')
    expect(step(state, output, front).status).toBe('valid')
  })

  it('detects a high-speed run that crosses both triggers in one fixed step', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, front)
    expect(step(state, output, front).status).toBe('none')
    expect(step(state, output, back)).toEqual({
      status: 'valid',
      direction: 'frontToBack',
    })
  })

  it('detects a max-speed dodge sampled at 60 Hz without tunneling', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, {
      minimumAlongNormal: -0.91,
      maximumAlongNormal: -0.31,
      withinOpening: true,
    })
    expect(
      step(state, output, {
        minimumAlongNormal: -0.45,
        maximumAlongNormal: 0.15,
        withinOpening: true,
      }).status,
    ).toBe('partial')
    expect(
      step(state, output, {
        minimumAlongNormal: 0.31,
        maximumAlongNormal: 0.91,
        withinOpening: true,
      }).status,
    ).toBe('valid')
  })

  it('rejects jumping above the opening even when the normal extents cross', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, front)
    expect(
      step(state, output, { ...middle, withinOpening: false }).status,
    ).toBe('none')
    expect(step(state, output, { ...back, withinOpening: false }).status).toBe(
      'none',
    )
  })

  it('invalidates a tracked crossing that exits through the side', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    step(state, output, front)
    step(state, output, middle)
    expect(
      step(state, output, { ...middle, withinOpening: false }).status,
    ).toBe('none')
    expect(step(state, output, back).status).toBe('none')
  })

  it('reuses the caller-owned result and handles a negative trigger offset', () => {
    const state = createCrossingState()
    const output = createCrossingResult()
    const returned = stepCrossing(
      state,
      { minimumAlongNormal: -1, maximumAlongNormal: -0.1, withinOpening: true },
      -1,
      output,
    )
    expect(returned).toBe(output)
  })
})
