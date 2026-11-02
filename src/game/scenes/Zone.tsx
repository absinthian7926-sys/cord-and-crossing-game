import { TrainingDummies } from '../combat/TrainingDummies'
import { Enemies } from '../enemies/Enemies'
import { CameraRig } from '../player/CameraRig'
import { PlayerController } from '../player/PlayerController'
import { QuestWorld } from '../quest/QuestWorld'
import { CordWeapon } from '../weapons/CordWeapon'
import { Lighting } from '../world/Lighting'
import { Locations } from '../world/Locations'
import { Scenery } from '../world/Scenery'
import { Sea } from '../world/Sea'
import { Terrain } from '../world/TerrainView'

export function Zone() {
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
      <CameraRig />
    </>
  )
}
