import { useEffect, useRef } from 'react'
import { ZONE } from '../data/zone'
import { playerStore } from '../game/player/playerStore'
import { getQuestRuntimeSnapshot } from '../game/quest/questRuntime'
import { getSceneRuntimeSnapshot } from '../game/scenes/sceneRuntime'
import {
  COMPASS,
  createCompassMarker,
  resolveCompassMarker,
  shortestDegreeDelta,
} from './compass'
import { compassRuntime } from './compassRuntime'

const waystationMarker = createCompassMarker()
const objectiveMarker = createCompassMarker()

function placeBearing(
  element: HTMLElement | null,
  headingDegrees: number,
  bearingDegrees: number,
): boolean {
  if (!element) return false
  const relative = shortestDegreeDelta(headingDegrees, bearingDegrees)
  const visible = Math.abs(relative) <= COMPASS.spanDegrees / 2
  element.style.display = visible ? 'block' : 'none'
  element.style.transform = `translateX(calc(-50% + ${(relative * COMPASS.widthPixels) / COMPASS.spanDegrees}px))`
  return visible
}

function placeMarker(
  element: HTMLElement | null,
  headingDegrees: number,
  playerX: number,
  playerZ: number,
  markerX: number,
  markerZ: number,
  marker: typeof waystationMarker,
): boolean {
  resolveCompassMarker(
    headingDegrees,
    playerX,
    playerZ,
    markerX,
    markerZ,
    marker,
  )
  if (!element) return marker.visible
  element.style.display = marker.visible ? 'block' : 'none'
  element.style.transform = `translateX(calc(-50% + ${marker.offsetPixels}px))`
  return marker.visible
}

export function Compass() {
  const heading = useRef<HTMLSpanElement>(null)
  const north = useRef<HTMLSpanElement>(null)
  const east = useRef<HTMLSpanElement>(null)
  const south = useRef<HTMLSpanElement>(null)
  const west = useRef<HTMLSpanElement>(null)
  const waystation = useRef<HTMLSpanElement>(null)
  const objective = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const refresh = () => {
      const player = playerStore.getState()
      const headingDegrees = player.cameraHeadingDegrees
      compassRuntime.headingDegrees = headingDegrees
      if (heading.current)
        heading.current.textContent = `${Math.round(headingDegrees)}°`
      placeBearing(north.current, headingDegrees, 0)
      placeBearing(east.current, headingDegrees, 90)
      placeBearing(south.current, headingDegrees, 180)
      placeBearing(west.current, headingDegrees, 270)

      const scene = getSceneRuntimeSnapshot().currentScene
      const quest = getQuestRuntimeSnapshot().quest
      if (scene === 'hollow') {
        if (waystation.current) waystation.current.style.display = 'none'
        compassRuntime.waystationVisible = false
        compassRuntime.objectiveLabel = 'Return screen'
        if (objective.current) objective.current.textContent = 'Return screen'
        compassRuntime.objectiveVisible = placeMarker(
          objective.current,
          headingDegrees,
          player.position.x,
          player.position.z,
          ZONE.hollow.porticoCenter[0],
          ZONE.hollow.porticoCenter[1],
          objectiveMarker,
        )
        return
      }

      compassRuntime.waystationVisible = placeMarker(
        waystation.current,
        headingDegrees,
        player.position.x,
        player.position.z,
        ZONE.locations.A.center[0],
        ZONE.locations.A.center[1],
        waystationMarker,
      )

      let objectiveX = 0
      let objectiveZ = 0
      let objectiveLabel = ''
      if (quest.currentStep === 2) {
        objectiveX = ZONE.locations.D.center[0]
        objectiveZ = ZONE.locations.D.center[1]
        objectiveLabel = 'Camp'
      } else if (quest.currentStep === 4) {
        objectiveX = ZONE.locations.E.center[0]
        objectiveZ = ZONE.locations.E.center[1]
        objectiveLabel = 'Ruin Shelf'
      }
      compassRuntime.objectiveLabel = objectiveLabel
      if (!objectiveLabel) {
        compassRuntime.objectiveVisible = false
        if (objective.current) objective.current.style.display = 'none'
        return
      }
      if (objective.current) objective.current.textContent = objectiveLabel
      compassRuntime.objectiveVisible = placeMarker(
        objective.current,
        headingDegrees,
        player.position.x,
        player.position.z,
        objectiveX,
        objectiveZ,
        objectiveMarker,
      )
    }

    refresh()
    const interval = window.setInterval(refresh, 1_000 / COMPASS.sampleHertz)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="compass" aria-label="Compass">
      <span ref={heading} className="compass-heading">
        0°
      </span>
      <span ref={north} className="compass-bearing">
        N
      </span>
      <span ref={east} className="compass-bearing">
        E
      </span>
      <span ref={south} className="compass-bearing">
        S
      </span>
      <span ref={west} className="compass-bearing">
        W
      </span>
      <span ref={waystation} className="compass-marker">
        Waystation
      </span>
      <span ref={objective} className="compass-marker compass-objective" />
    </div>
  )
}
