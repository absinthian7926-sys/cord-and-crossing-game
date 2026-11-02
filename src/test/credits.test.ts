import { describe, expect, it } from 'vitest'
import { CREDITS_LINES } from '../data/credits'

describe('Slice 1 credits', () => {
  it('uses the exact approved allow-list and credits Ryan only as RJ', () => {
    expect(CREDITS_LINES).toEqual([
      'Cord and Crossing',
      'Co-developed with AI by RJ and Absinthian.',
      'Design and direction: RJ',
      'Models: made for this project with Blender scripts and code (CC0).',
      'Audio: generated in code for this project (CC0).',
      "Built with open-source software: Blender, Vite, React, three.js, React Three Fiber, drei, Rapier, zustand, postprocessing. See each project's license.",
    ])
    expect(CREDITS_LINES.join('\n')).not.toMatch(/Ryan|Jeter/)
  })
})
