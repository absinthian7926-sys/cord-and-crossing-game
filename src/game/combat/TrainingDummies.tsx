import { TRAINING_DUMMIES } from '../../data/weapons'
import { heightAt } from '../world/terrain'
import { TrainingDummy } from './TrainingDummy'

export function TrainingDummies() {
  return (
    <>
      {TRAINING_DUMMIES.map((dummy) => (
        <TrainingDummy
          key={dummy.id}
          id={dummy.id}
          position={[
            dummy.position[0],
            heightAt(dummy.position[0], dummy.position[2]) + dummy.position[1],
            dummy.position[2],
          ]}
          cordCutter={dummy.cordCutter}
        />
      ))}
    </>
  )
}
