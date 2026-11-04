import { expect, test, type Page } from '@playwright/test'
import type { QualityLevel } from '../src/data/zone'
import { ZONE } from '../src/data/zone'
import { startGame } from './helpers'

test.setTimeout(240_000)

type Sample = ReturnType<
  NonNullable<Window['__CORD_AND_CROSSING_DEBUG__']>['getPerfStats']
>

async function sample(page: Page, label: string): Promise<Sample> {
  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.resetPerfStats(),
  )
  await page.waitForTimeout(1_750)
  const stats = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  expect(stats.drawCalls, `${label} draw calls`).toBeGreaterThan(0)
  expect(stats.drawCalls, `${label} draw calls`).toBeLessThan(250)
  expect(stats.triangles, `${label} triangles`).toBeLessThan(500_000)
  return stats
}

async function rotateCamera(page: Page, movementX: number): Promise<void> {
  await page.locator('canvas').dispatchEvent('pointerdown', { button: 1 })
  await page.evaluate((amount) => {
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        movementX: amount,
        movementY: 0,
        bubbles: true,
      }),
    )
  }, movementX)
  await page.locator('canvas').dispatchEvent('pointerup', { button: 1 })
}

test('records M7 performance at every required scene and tier', async ({
  page,
}) => {
  await startGame(page, { newGame: true })
  const tiers: readonly QualityLevel[] = ['Low', 'Medium', 'High']
  const results: Record<string, Sample> = {}
  const postCosts: Record<string, { spawnMs: number; campMs: number }> = {}

  for (const tier of tiers) {
    await page.evaluate(
      ({ quality, spawn }) => {
        const debug = window.__CORD_AND_CROSSING_DEBUG__!
        debug.setSetting('quality', quality)
        debug.setPostEnabled(null)
        debug.loadScene('zone')
        debug.teleport(spawn[0], spawn[2])
      },
      { quality: tier, spawn: ZONE.spawn },
    )
    await page.waitForFunction(
      (quality) =>
        window.__CORD_AND_CROSSING_DEBUG__!.getQualityTier() === quality,
      tier,
    )

    results[`${tier}.spawn`] = await sample(page, `${tier} spawn`)
    if (tier !== 'Low') {
      await page.evaluate(() =>
        window.__CORD_AND_CROSSING_DEBUG__!.setPostEnabled(false),
      )
      const off = await sample(page, `${tier} spawn post off`)
      await page.evaluate(() =>
        window.__CORD_AND_CROSSING_DEBUG__!.setPostEnabled(true),
      )
      const on = await sample(page, `${tier} spawn post on`)
      postCosts[tier] = {
        spawnMs: on.frameTimeMeanMs - off.frameTimeMeanMs,
        campMs: 0,
      }
    }

    await page.evaluate((porticoCenter) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      debug.setPostEnabled(null)
      debug.unlockPortico()
      debug.teleport(porticoCenter[0] - 2, porticoCenter[1])
    }, ZONE.portico.center)
    await rotateCamera(page, 390)
    await page.waitForFunction(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getPorticoScreenInView(),
      undefined,
      { timeout: 5_000 },
    )
    results[`${tier}.shelf`] = await sample(page, `${tier} Ruin Shelf`)

    await rotateCamera(page, -390)
    const campIds = await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.stageWorstCaseCamp(),
    )
    await page.waitForFunction(
      (ids) => {
        const debug = window.__CORD_AND_CROSSING_DEBUG__!
        return (
          debug.getCampFrustumCount() === 10 &&
          debug.getActiveArrowCount() > 0 &&
          debug.getCordState() === 'Out' &&
          debug
            .getEnemies()
            .filter((enemy) => ids.includes(enemy.id))
            .every((enemy) => enemy.inFrustum)
        )
      },
      campIds,
      { timeout: 20_000 },
    )
    results[`${tier}.camp`] = await sample(page, `${tier} camp`)
    if (tier !== 'Low') {
      await page.evaluate(() =>
        window.__CORD_AND_CROSSING_DEBUG__!.setPostEnabled(false),
      )
      const off = await sample(page, `${tier} camp post off`)
      await page.evaluate(() =>
        window.__CORD_AND_CROSSING_DEBUG__!.setPostEnabled(true),
      )
      const on = await sample(page, `${tier} camp post on`)
      postCosts[tier].campMs = on.frameTimeMeanMs - off.frameTimeMeanMs
    }

    await page.evaluate(() => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      debug.setPostEnabled(null)
      debug.pause(true)
    })
    results[`${tier}.pause`] = await sample(page, `${tier} pause`)
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.pause(false))

    await page.evaluate(() => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      debug.prepareHollowEncounter()
      debug.loadScene('hollow')
    })
    await page.waitForFunction(
      () =>
        window.__CORD_AND_CROSSING_DEBUG__!.getScene() === 'hollow' &&
        window
          .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
          .filter((enemy) => enemy.id.startsWith('hollow-final-')).length === 3,
      undefined,
      { timeout: 10_000 },
    )
    results[`${tier}.hollowArrival`] = await sample(
      page,
      `${tier} Hollow arrival`,
    )
    const hollowIds = await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.stageWorstCaseHollow(),
    )
    await page.waitForFunction(
      (ids) => {
        const debug = window.__CORD_AND_CROSSING_DEBUG__!
        return (
          ids.length === 3 &&
          debug.getHollowFrustumCount() === 3 &&
          debug.getActiveArrowCount() > 0 &&
          debug.getCordState() === 'Out'
        )
      },
      hollowIds,
      { timeout: 10_000 },
    )
    results[`${tier}.hollowFight`] = await sample(page, `${tier} Hollow fight`)
  }

  console.log(`m7 performance=${JSON.stringify({ results, postCosts })}`)
})
