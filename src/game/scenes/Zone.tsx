import { TrainingDummies } from '../combat/TrainingDummies'
import { Enemies } from '../enemies/Enemies'
import { CameraRig } from '../player/CameraRig'
import { PlayerController } from '../player/PlayerController'
import { Portico } from '../portico/Portico'
import { handlePorticoCrossing } from '../portico/porticoGameplay'
import {
  getPorticoRuntimeSnapshot,
  subscribePorticoRuntime,
} from '../portico/porticoRuntime'
import { QuestWorld } from '../quest/QuestWorld'
import { CordWeapon } from '../weapons/CordWeapon'
import { Lighting } from '../world/Lighting'
import { Locations } from '../world/Locations'
import { Scenery } from '../world/Scenery'
import { Sea } from '../world/Sea'
import { Terrain } from '../world/TerrainView'
import { heightAt } from '../world/terrain'

export function Zone() {
  const portico = useSyncExternalStore(
    subscribePorticoRuntime,
    getPorticoRuntimeSnapshot,
    getPorticoRuntimeSnapshot,
  )
  const porticoX = ZONE.portico.center[0]
  const porticoZ = ZONE.portico.center[1]
  return (
    <>
      <Lighting />
      <Terrain />
      <Sea />
      <Scenery />
      <Locations />
      <PlayerController />
      <CordWeapon />
      <TrainingDummies />
      <Enemies />
      <QuestWorld />
      <Portico
        kind="zone"
        center={[porticoX, heightAt(porticoX, porticoZ), porticoZ]}
        normal={ZONE.portico.normal}
        active={portico.phase === 'active'}
        keyUseEnabled={portico.phase === 'locked'}
        onValidCrossing={handlePorticoCrossing}
      />
      <CameraRig />
    </>
  )
}
import { useSyncExternalStore } from 'react'
import { ZONE } from '../../data/zone'
