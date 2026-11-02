export type CompassSnapshot = {
  headingDegrees: number
  waystationVisible: boolean
  objectiveVisible: boolean
  objectiveLabel: string
}

export const compassRuntime: CompassSnapshot = {
  headingDegrees: 0,
  waystationVisible: false,
  objectiveVisible: false,
  objectiveLabel: '',
}

export function getCompassSnapshot(): CompassSnapshot {
  return { ...compassRuntime }
}
