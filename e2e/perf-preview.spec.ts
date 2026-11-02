import { expect, test, type Page } from '@playwright/test'

function isPerfChunk(url: string): boolean {
  return /\/assets\/PerfOverlay-[^/]+\.js(?:\?|$)/.test(url)
}

function isPostChunk(url: string): boolean {
  return /\/assets\/PostEffects-[^/]+\.js(?:\?|$)/.test(url)
}

async function collectPerfChunkRequests(
  page: Page,
  path: string,
): Promise<string[]> {
  const requests: string[] = []
  page.on('request', (request) => {
    if (isPerfChunk(request.url())) requests.push(request.url())
  })
  await page.goto(path)
  return requests
}

test('production preview omits the perf readout without the query flag', async ({
  page,
}) => {
  const requests = await collectPerfChunkRequests(page, '/')

  await expect(
    page.getByRole('heading', { name: 'Cord and Crossing' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__),
  ).toBeUndefined()
  await expect(page.getByLabel('Performance statistics')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('production preview loads and shows the perf readout with perf=1', async ({
  page,
}) => {
  const requests = await collectPerfChunkRequests(page, '/?perf=1')
  const overlay = page.getByLabel('Performance statistics')

  await expect(overlay).toBeVisible()
  await expect(overlay).toContainText('fps')
  await expect(overlay).toContainText('ms mean')
  await expect(overlay).toContainText('ms p95')
  await expect(overlay).toContainText('fps 1% low')
  await expect(overlay).toContainText('draws')
  await expect(overlay).toContainText('tris')
  await expect(overlay).toContainText('tier')
  await expect(overlay).toContainText('dpr')
  await expect(overlay).toContainText('scene')
  expect((await overlay.textContent())?.split('\n').at(-1)).toBeTruthy()
  expect(requests).toHaveLength(1)
})

test('production preview loads post effects at Medium as a separate chunk', async ({
  page,
}) => {
  const postRequests: string[] = []
  page.on('request', (request) => {
    if (isPostChunk(request.url())) postRequests.push(request.url())
  })

  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Cord and Crossing' }),
  ).toBeVisible()
  await expect.poll(() => postRequests.length).toBe(1)
})

test('production preview does not request post effects at Low', async ({
  page,
}) => {
  const postRequests: string[] = []
  page.on('request', (request) => {
    if (isPostChunk(request.url())) postRequests.push(request.url())
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      'cord-and-crossing.settings.v1',
      JSON.stringify({
        settingsVersion: 1,
        volumes: { master: 80, music: 50, sfx: 80, ambient: 60 },
        quality: 'Low',
        qualityChosenByHand: true,
        reduceMotion: false,
        reduceMotionSetByHand: false,
        mouseSensitivity: 1,
        invertY: false,
      }),
    )
  })

  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Cord and Crossing' }),
  ).toBeVisible()
  await page.waitForTimeout(500)
  expect(postRequests).toEqual([])
})
