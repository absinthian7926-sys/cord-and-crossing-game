import { describe, expect, it } from 'vitest'
import { CAMP_LEADER, ENEMY_SPAWNS } from '../data/enemies'
import { createCampLeaderSpawn, createSpawnPlan } from '../game/enemies/spawns'

describe('camp group layout', () => {
  it('keeps the nine standard enemies in three balanced groups', () => {
    const camp = createSpawnPlan().filter(({ group }) => group === 'camp')
    expect(camp).toHaveLength(9)
    expect(
      camp.filter(({ enemyType }) => enemyType === 'roadBrigand'),
    ).toHaveLength(6)
    expect(
      camp.filter(({ enemyType }) => enemyType === 'brigandArcher'),
    ).toHaveLength(3)

    for (const group of ENEMY_SPAWNS.camp.groups) {
      const members = camp.filter(({ campGroup }) => campGroup === group.id)
      expect(
        members.filter(({ enemyType }) => enemyType === 'roadBrigand'),
      ).toHaveLength(2)
      expect(
        members.filter(({ enemyType }) => enemyType === 'brigandArcher'),
      ).toHaveLength(1)
    }
  })

  it('separates group centers by at least 24 m', () => {
    const groups = ENEMY_SPAWNS.camp.groups
    for (let left = 0; left < groups.length; left += 1) {
      for (let right = left + 1; right < groups.length; right += 1) {
        expect(
          Math.hypot(
            groups[left].groupOffset[0] - groups[right].groupOffset[0],
            groups[left].groupOffset[1] - groups[right].groupOffset[1],
          ),
        ).toBeGreaterThanOrEqual(24)
      }
    }
  })

  it('places melee within 3 m and each archer at the 5 m outer edge', () => {
    const camp = createSpawnPlan().filter(({ group }) => group === 'camp')
    for (const group of ENEMY_SPAWNS.camp.groups) {
      const centerX = ENEMY_SPAWNS.camp.anchor[0] + group.groupOffset[0]
      const centerZ = ENEMY_SPAWNS.camp.anchor[1] + group.groupOffset[1]
      for (const member of camp.filter(
        ({ campGroup }) => campGroup === group.id,
      )) {
        const distance = Math.hypot(member.x - centerX, member.z - centerZ)
        if (member.enemyType === 'brigandArcher') {
          expect(distance).toBeCloseTo(5, 8)
        } else {
          expect(distance).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('keeps the leader at the fire in the leader group', () => {
    const spawn = createCampLeaderSpawn({
      questStep: 2,
      keyLooted: false,
      leaderDefeated: false,
    })
    expect(spawn).toMatchObject({
      campGroup: 'leader',
      x: ENEMY_SPAWNS.camp.anchor[0] + CAMP_LEADER.campOffset[0],
      z: ENEMY_SPAWNS.camp.anchor[1] + CAMP_LEADER.campOffset[1],
    })
  })
})
