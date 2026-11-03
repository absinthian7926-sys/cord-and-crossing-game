import { useEffect, useSyncExternalStore } from 'react'
import { CAMP_LEADER, ENEMY_SPAWNS } from '../../data/enemies'
import { FRAME_SHELTER_KEY } from '../../data/quests'
import { Hollen } from '../npc/Hollen'
import {
  ensureCampLeaderSpawned,
  releaseCampEnemyRespawns,
  registerCampLeaderDefeatedHandler,
  setCampLeaderDefeated,
} from '../enemies/enemyRuntime'
import { heightAt } from '../world/terrain'
import { FrameShelterKey } from './FrameShelterKey'
import {
  getQuestRuntimeSnapshot,
  markCampLeaderDefeated,
  restorePendingKeyDrop,
  setHollenNearby,
  setHollenNearbyTransient,
  subscribeQuestRuntime,
} from './questRuntime'

const campLeaderX = ENEMY_SPAWNS.camp.anchor[0] + CAMP_LEADER.campOffset[0]
const campLeaderZ = ENEMY_SPAWNS.camp.anchor[1] + CAMP_LEADER.campOffset[1]
const fallbackKeyDrop = {
  x: campLeaderX,
  y:
    heightAt(campLeaderX, campLeaderZ) +
    FRAME_SHELTER_KEY.presentation.ringRadius,
  z: campLeaderZ,
}

export function QuestWorld() {
  const snapshot = useSyncExternalStore(
    subscribeQuestRuntime,
    getQuestRuntimeSnapshot,
    getQuestRuntimeSnapshot,
  )

  useEffect(() => {
    registerCampLeaderDefeatedHandler((_id, x, _y, z) => {
      markCampLeaderDefeated({
        x,
        y: heightAt(x, z) + FRAME_SHELTER_KEY.presentation.ringRadius,
        z,
      })
    })
    return () => registerCampLeaderDefeatedHandler(null)
  }, [])

  useEffect(() => {
    setCampLeaderDefeated(snapshot.campLeaderDefeated)
    ensureCampLeaderSpawned({
      questStep: snapshot.quest.currentStep,
      keyLooted: snapshot.quest.keyLooted,
      leaderDefeated: snapshot.campLeaderDefeated,
    })
    if (
      snapshot.campLeaderDefeated &&
      !snapshot.quest.keyLooted &&
      snapshot.keyDrop === null
    )
      restorePendingKeyDrop(fallbackKeyDrop)
  }, [
    snapshot.campLeaderDefeated,
    snapshot.keyDrop,
    snapshot.quest.currentStep,
    snapshot.quest.keyLooted,
  ])

  useEffect(() => {
    if (snapshot.quest.keyLooted) releaseCampEnemyRespawns()
  }, [snapshot.quest.keyLooted])

  return (
    <>
      <Hollen
        dialogueOpen={snapshot.dialogue.currentNodeId !== null}
        onProximityChange={setHollenNearby}
        onTransientProximityChange={setHollenNearbyTransient}
      />
      <FrameShelterKey />
    </>
  )
}
