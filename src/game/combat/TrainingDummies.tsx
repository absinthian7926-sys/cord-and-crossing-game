import { TRAINING_DUMMIES } from '../../data/weapons'
import { TrainingDummy } from './TrainingDummy'

export function TrainingDummies() {
  return (
    <>
      {TRAINING_DUMMIES.map((dummy) => (
        <TrainingDummy
          key={dummy.id}
          id={dummy.id}
          position={dummy.position}
          cordCutter={dummy.cordCutter}
        />
      ))}
    </>
  )
}
