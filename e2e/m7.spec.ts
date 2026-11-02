import { expect, test, type Page } from '@playwright/test'
import { CREDITS_LINES } from '../src/data/credits'
import { ENEMY_TYPES } from '../src/data/enemies'
import { PLAYER } from '../src/data/player'
import { SETTINGS } from '../src/data/settings'
import { ZONE } from '../src/data/zone'
import { resumeGameAfterReload, startGame } from './helpers'

test.setTimeout(120_000)

function watchBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

function dispatchMouseButton(page: Page, button: number, down: boolean) {
  return page.evaluate(
    ({ mouseButton, eventName }) =>
      window.dispatchEvent(
        new MouseEvent(eventName, {
          button: mouseButton,
          bubbles: true,
        }),
      ),
    {
      mouseButton: button,
      eventName: down ? 'mousedown' : 'mouseup',
    },
  )
}

test('title, credits, lazy audio, models, animation and game feel work together', async ({
  page,
}) => {
  const browserErrors = watchBrowserErrors(page)
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))

  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: CREDITS_LINES[0] }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
  expect(requests.some((url) => url.includes('/game/audio/audio.ts'))).toBe(
    false,
  )

  const audioLoadStartedAt = await page.evaluate(() => performance.now())
  await page.getByRole('button', { name: 'Credits' }).click()
  const credits = page.getByRole('dialog', { name: CREDITS_LINES[0] })
  await expect(credits).toBeVisible()
  for (const line of CREDITS_LINES.slice(1))
    await expect(credits.getByText(line, { exact: true })).toBeVisible()
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__?.getAudioState().loaded === true,
  )
  expect(requests.some((url) => url.includes('/game/audio/audio.ts'))).toBe(
    true,
  )
  const audioEngineLoadMilliseconds = await page.evaluate(
    (startedAt) => performance.now() - startedAt,
    audioLoadStartedAt,
  )
  expect(audioEngineLoadMilliseconds).toBeGreaterThan(0)
  console.log(
    `m7 audio engine loadMs=${audioEngineLoadMilliseconds.toFixed(1)}`,
  )
  await credits.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'New game' }).click()
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__ !== undefined,
  )

  await page.waitForFunction(() => {
    const animation = window.__CORD_AND_CROSSING_DEBUG__!.getAnimationState()
    return animation.activeControllers > 0 && animation.heroClipId === 'idle'
  })
  await expect(page.getByLabel('Compass')).toBeVisible()
  const initialHeading = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCompass().headingDegrees,
  )
  await page.locator('canvas').dispatchEvent('pointerdown', { button: 1 })
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        movementX: 180,
        movementY: 0,
        bubbles: true,
      }),
    ),
  )
  await page.locator('canvas').dispatchEvent('pointerup', { button: 1 })
  await page.waitForFunction(
    (heading) =>
      Math.abs(
        window.__CORD_AND_CROSSING_DEBUG__!.getCompass().headingDegrees -
          heading,
      ) > 5,
    initialHeading,
  )

  await page.keyboard.down('KeyW')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getAnimationState().heroClipId ===
        'run' &&
      window
        .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
        .lastCueIds.includes('footstep'),
    undefined,
    { timeout: 10_000 },
  )
  await page.keyboard.up('KeyW')
  expect(
    await page.evaluate(
      () =>
        window.__CORD_AND_CROSSING_DEBUG__!.getAudioState().lastFootstepSurface,
    ),
  ).toBe('dirt')
  await page.keyboard.press('KeyC')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getAnimationState().heroClipId ===
      'dodge',
  )

  await dispatchMouseButton(page, 2, true)
  await page.waitForTimeout(300)
  await dispatchMouseButton(page, 2, false)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'Out' &&
      window.__CORD_AND_CROSSING_DEBUG__!.getAnimationState().heroClipId ===
        'cast',
  )
  await page.waitForFunction(() =>
    window
      .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
      .lastCueIds.includes('cast-whistle'),
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 10_000 },
  )
  await page.locator('canvas').dispatchEvent('pointerdown', { button: 1 })
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        movementX: -180,
        movementY: 0,
        bubbles: true,
      }),
    ),
  )
  await page.locator('canvas').dispatchEvent('pointerup', { button: 1 })

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(0, -1.7),
  )
  const flashCount = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().flashes.enemyCount,
  )
  await dispatchMouseButton(page, 0, true)
  await page.waitForTimeout(300)
  await dispatchMouseButton(page, 0, false)
  await page.waitForFunction(
    (before) =>
      window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().flashes.enemyCount >
        before &&
      window
        .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
        .lastCueIds.includes('hit-flesh'),
    flashCount,
    { timeout: 10_000 },
  )

  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.teleport(30, 0))
  const hurtFlashCount = await page.evaluate(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().flashes.playerCount,
  )
  await page.locator('.player-hit-vignette').evaluate((element) => {
    const target = element as HTMLElement
    target.dataset.seenVisible = 'false'
    const observer = new MutationObserver(() => {
      if (Number.parseFloat(target.style.opacity) > 0) {
        target.dataset.seenVisible = 'true'
        observer.disconnect()
      }
    })
    observer.observe(target, { attributes: true, attributeFilter: ['style'] })
  })
  const attackerId = await page.evaluate((attackRange) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const player = debug.getPlayerPosition()
    return debug.spawnEnemy(
      'roadBrigand',
      player.x + attackRange - 0.1,
      player.z,
    )
  }, ENEMY_TYPES.roadBrigand.attackRange)
  await page.waitForFunction(
    (before) => {
      const feel = window.__CORD_AND_CROSSING_DEBUG__!.getFeelState()
      return (
        feel.flashes.playerCount > before &&
        feel.flashes.playerOpacity > 0 &&
        feel.trauma > 0 &&
        Math.hypot(feel.offset.x, feel.offset.y, feel.offset.z) > 0
      )
    },
    hurtFlashCount,
    { timeout: 15_000 },
  )
  await expect(page.locator('.player-hit-vignette')).toHaveAttribute(
    'data-seen-visible',
    'true',
  )
  await page.evaluate((id) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    debug.killEnemy(id)
    debug.setSetting('reduceMotion', true)
  }, attackerId)
  await page.waitForFunction(() => {
    const feel = window.__CORD_AND_CROSSING_DEBUG__!.getFeelState()
    return Math.hypot(feel.offset.x, feel.offset.y, feel.offset.z) === 0
  })
  const blockFlashCount = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().flashes.blockCount,
  )
  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.forceBucklerBlockFeedback(),
  )
  await page.waitForFunction((before) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    return (
      debug.getFeelState().flashes.blockCount > before &&
      debug.getAudioState().lastCueIds.includes('hit-block')
    )
  }, blockFlashCount)

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.damagePlayer(1_000),
  )
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().deathPhase ===
      'Fading',
  )
  await expect(page.locator('.player-death-fade')).toBeVisible()
  expect(
    await page
      .locator('.player-death-fade')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toContain('0.3s')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().deathPhase ===
      'Alive',
  )

  await page.waitForFunction(
    () =>
      ['/models/hero.glb', '/models/roadBrigand.glb'].every((path) =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.endsWith(path) && entry.duration > 0),
      ),
    undefined,
    { timeout: 10_000 },
  )
  expect(browserErrors).toEqual([])
})

test('pause freezes gameplay and settings survive restart', async ({
  page,
}) => {
  const browserErrors = watchBrowserErrors(page)
  await startGame(page, { newGame: true })
  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.teleport(30, 0))
  await page.waitForFunction(
    () =>
      Math.abs(window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition().x - 30) <
      0.5,
  )
  await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    debug.grantEffect('Strength')
    debug.saveGame()
  })
  const enemyId = await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const player = debug.getPlayerPosition()
    return debug.spawnEnemy('roadBrigand', player.x + 8, player.z)
  })
  await page.waitForFunction(
    (id) =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .some((enemy) => enemy.id === id && enemy.state === 'Chase'),
    enemyId,
  )
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getAudioState().musicLayer ===
      'combat',
    undefined,
    { timeout: 10_000 },
  )

  await page.keyboard.press('Escape')
  const pause = page.getByRole('dialog', { name: 'Paused' })
  await expect(pause).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()
  for (const name of ['Controls', 'Graphics', 'Volume', 'Restart', 'Credits']) {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name })).toBeFocused()
  }
  await page.keyboard.press('Enter')
  const pauseCredits = page.getByRole('dialog', { name: 'Cord and Crossing' })
  await expect(pauseCredits).toBeVisible()
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getAudioState().musicLayer ===
      'explore',
  )
  await pauseCredits.getByRole('button', { name: 'Back' }).click()

  const frozen = await page.evaluate((id) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const enemy = debug.getEnemies().find((entry) => entry.id === id)!
    return {
      player: debug.getPlayerPosition(),
      enemy: enemy.position,
      effect: debug.getEffects()[0].remainingSeconds,
    }
  }, enemyId)
  await page.waitForTimeout(1_000)
  expect(
    await page.evaluate((id) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const enemy = debug.getEnemies().find((entry) => entry.id === id)!
      return {
        player: debug.getPlayerPosition(),
        enemy: enemy.position,
        effect: debug.getEffects()[0].remainingSeconds,
      }
    }, enemyId),
  ).toEqual(frozen)

  await page.getByRole('button', { name: 'Resume' }).click()
  await page.waitForFunction(
    (before) =>
      window.__CORD_AND_CROSSING_DEBUG__!.getEffects()[0].remainingSeconds <
      before,
    frozen.effect,
  )
  await page.evaluate(() =>
    document.dispatchEvent(new Event('pointerlockchange')),
  )
  await expect(pause).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()

  await page.getByRole('button', { name: 'Graphics' }).click()
  await page.getByRole('radio', { name: 'Low' }).check()
  await page.waitForFunction(() => {
    const settings = window.__CORD_AND_CROSSING_DEBUG__!.getSettings()
    return (
      settings.quality === 'Low' &&
      settings.qualityProfile.shadowMapSize === 1_024 &&
      settings.qualityProfile.drawDistance === 450
    )
  })
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Volume' }).click()
  await page.getByRole('slider', { name: 'Master' }).fill('37')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Resume' }).click()
  await page.waitForTimeout(SETTINGS.writeDebounceMilliseconds + 100)

  await resumeGameAfterReload(page)
  expect(
    await page.evaluate(() => {
      const settings = window.__CORD_AND_CROSSING_DEBUG__!.getSettings()
      return { quality: settings.quality, master: settings.volumes.master }
    }),
  ).toEqual({ quality: 'Low', master: 37 })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Restart' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Restart' })
    .click()
  await page.waitForFunction(([spawnX, , spawnZ]) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const player = debug.getPlayerPosition()
    return (
      debug.getQuest().quest.currentStep === 1 &&
      Math.hypot(player.x - spawnX, player.z - spawnZ) < 0.5
    )
  }, ZONE.spawn)
  expect(
    await page.evaluate(() => {
      const settings = window.__CORD_AND_CROSSING_DEBUG__!.getSettings()
      return { quality: settings.quality, master: settings.volumes.master }
    }),
  ).toEqual({ quality: 'Low', master: 37 })
  expect(browserErrors).toEqual([])
})

test('low quality gates post, fallback models stay playable, and Medium loads post lazily', async ({
  page,
}) => {
  const browserErrors = watchBrowserErrors(page)
  const warnings: string[] = []
  const postRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('request', (request) => {
    if (request.url().includes('/game/feel/PostEffects.tsx'))
      postRequests.push(request.url())
  })
  await page.addInitScript(
    (settings) => {
      localStorage.setItem(
        'cord-and-crossing.settings.v1',
        JSON.stringify(settings),
      )
    },
    {
      settingsVersion: 1,
      volumes: { master: 80, music: 50, sfx: 80, ambient: 60 },
      quality: 'Low',
      qualityChosenByHand: false,
      reduceMotion: false,
      reduceMotionSetByHand: false,
      mouseSensitivity: 1,
      invertY: false,
    },
  )
  await page.route('**/models/hero.glb', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await startGame(page, { newGame: true })
  await page.waitForTimeout(500)
  expect(postRequests).toEqual([])
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().post.effects,
    ),
  ).toEqual([])
  await page.waitForFunction(() =>
    performance
      .getEntriesByType('resource')
      .some(
        (entry) =>
          entry.name.endsWith('/models/hero.glb') && entry.duration > 0,
      ),
  )
  expect(warnings.some((entry) => entry.includes('/models/hero.glb'))).toBe(
    true,
  )
  const start = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition(),
  )
  await page.keyboard.down('KeyW')
  await page.waitForFunction((origin) => {
    const player = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
    return Math.hypot(player.x - origin.x, player.z - origin.z) > 0.5
  }, start)
  await page.keyboard.up('KeyW')

  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.setSetting('quality', 'Medium'),
    ),
  ).toBe(true)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().post.tier ===
        'Medium' &&
      window.__CORD_AND_CROSSING_DEBUG__!.getFeelState().post.effects.length >
        0,
  )
  await expect.poll(() => postRequests.length).toBeGreaterThan(0)
  expect(
    browserErrors.filter((entry) => !entry.includes('Failed to load resource')),
  ).toEqual([])
})

test('automatic quality fallback lowers one tier and explains the change', async ({
  page,
}) => {
  await startGame(page, { newGame: true })
  expect(
    await page.evaluate(() => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      debug.forceFps(44)
      return debug.getQualityTier()
    }),
  ).toBe('Medium')
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getQualityTier() === 'Low',
    undefined,
    { timeout: 12_000 },
  )
  await expect(page.getByRole('status')).toHaveText(
    'Graphics set to Low for smoother play. Change it in Pause, Graphics.',
  )
})

test('Ruin Shelf colliders still block the camera and player', async ({
  page,
}) => {
  await startGame(page, { newGame: true })
  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(599.4, -77.8),
  )
  await page.waitForFunction(
    () => {
      const loaded = window.__CORD_AND_CROSSING_DEBUG__!.getLoadedModels()
      return (
        loaded.includes('ruinFramePost') && loaded.includes('porticoPillar')
      )
    },
    undefined,
    { timeout: 10_000 },
  )
  expect(
    await page.evaluate(() =>
      ['/models/ruinFramePost.glb', '/models/porticoPillar.glb'].every((path) =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.endsWith(path)),
      ),
    ),
  ).toBe(true)
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__CORD_AND_CROSSING_DEBUG__!.getCameraDistance(),
        ),
      { timeout: 5_000 },
    )
    .toBeLessThan(PLAYER.camera.distance)
  const blockedDistance = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getCameraDistance(),
  )
  expect(blockedDistance).toBeLessThan(PLAYER.camera.minimumDistance)

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(590, -77.8),
  )
  await page.waitForFunction(
    (blocked) =>
      window.__CORD_AND_CROSSING_DEBUG__!.getCameraDistance() > blocked + 1,
    blockedDistance,
  )

  const footstepSequence = await page.evaluate(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getAudioState().lastFootstepSequence,
  )
  await page.keyboard.down('KeyW')
  await page.waitForFunction((before) => {
    const audio = window.__CORD_AND_CROSSING_DEBUG__!.getAudioState()
    return (
      audio.lastFootstepSequence > before &&
      audio.lastFootstepSurface === 'stone'
    )
  }, footstepSequence)
  await page.keyboard.up('KeyW')

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(600, -72),
  )
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1_500)
  await page.keyboard.up('KeyW')
  const player = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition(),
  )
  expect(player.z).toBeGreaterThan(-74.2)
})
