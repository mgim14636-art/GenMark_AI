import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const baseUrl = (process.env.GENMARK_CAPTURE_BASE_URL || process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const outputDir = path.join(root, 'output', 'playwright', 'mobile-screen-spec')
const tempDir = path.join(root, 'tmp', 'mobile-screen-spec')
const rawDir = path.join(tempDir, 'raw')
const onlyScreenFilter = process.env.GENMARK_CAPTURE_ONLY?.trim() || ''
const manifestPath = path.join(tempDir, onlyScreenFilter ? 'manifest-partial.json' : 'manifest.json')
const reportPath = path.join(tempDir, onlyScreenFilter ? 'report-partial.json' : 'report.json')
const framePath = path.join(outputDir, 'hero-frame.html')

const VIEWPORT = { width: 390, height: 844 }
const FRAME_VIEWPORT = { width: 406, height: 860 }
const WAIT_AFTER_NAVIGATION_MS = 1_100
const SCROLL_STEP = 764
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const RISKY_ENDPOINT = /(?:generation|generate|trademark|similarity|brand[-_/]?kits?|logo-candidates)/i
const LOADING_TEXT = /(?:로딩|불러오는 중|생성 중|분석 중|저장 중|만들고 있어요|loading|generating|analyzing)/i
const ERROR_PLACEHOLDER = /(?:ERR_[A-Z_]+|This site can.t be reached|페이지를 표시할 수 없습니다|사이트에 연결할 수 없음|Application error|Internal Server Error)/i

const moduleCandidates = {
  playwright: [
    'C:/Users/SMHRD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
    path.join(root, 'tmp', 'table-spec', 'node_modules', 'playwright', 'index.mjs'),
  ],
  sharp: [
    path.join(root, 'tmp', 'table-spec', 'node_modules', 'sharp', 'dist', 'index.mjs'),
    path.join(root, 'tmp', 'table-spec', 'node_modules', 'sharp', 'lib', 'index.js'),
  ],
}

const importFirstAvailable = async (name) => {
  const failures = []
  for (const candidate of moduleCandidates[name]) {
    try {
      await fs.access(candidate)
      return await import(pathToFileURL(candidate).href)
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`Unable to load ${name}. Tried:\n${failures.join('\n')}`)
}

const clickVisible = async (page, locator, description) => {
  const target = locator.first()
  await target.waitFor({ state: 'visible', timeout: 5_000 })
  await target.click()
  await page.waitForTimeout(250)
  if (description) console.log(`[state] ${description}`)
}

const screens = [
  { file: '01-hero-mobile', view: 'hero', forceSingle: true },
  { file: '02-home-mobile', view: 'home', alwaysSuffix: true },
  { file: '03-login-mobile', view: 'login', alwaysSuffix: true },
  { file: '04-onboarding-step1-mobile', view: 'onboarding', forceSingle: true },
  {
    file: '04-onboarding-step2-mobile',
    view: 'onboarding',
    forceSingle: true,
    setup: async (page) => {
      await clickVisible(page, page.getByRole('button', { name: '다음', exact: true }), 'onboarding next')
      await page.locator('main.onboarding-step-2').waitFor({ state: 'visible' })
    },
  },
  { file: '05-industry-mobile', view: 'industry', alwaysSuffix: true },
  { file: '06-choice-mobile', view: 'choice', forceSingle: true },
  {
    file: '06-choice-ci-modal-mobile',
    view: 'choice',
    forceSingle: true,
    setup: (page) => clickVisible(page, page.getByRole('button', { name: 'CI 설명 보기' }), 'CI aria-label info'),
  },
  {
    file: '06-choice-bi-modal-mobile',
    view: 'choice',
    forceSingle: true,
    setup: (page) => clickVisible(page, page.getByRole('button', { name: 'BI 설명 보기' }), 'BI aria-label info'),
  },
  { file: '07-brand-details-mobile', view: 'brand-details', alwaysSuffix: true },
  { file: '08-company-details-mobile', view: 'company-details', alwaysSuffix: true },
  { file: '09-tone-recommended-mobile', view: 'tone', alwaysSuffix: true },
  {
    file: '09-tone-direct-mobile',
    view: 'tone',
    alwaysSuffix: true,
    setup: async (page) => {
      await clickVisible(page, page.getByRole('tab', { name: '직접 지정' }), 'direct tone')
      await clickVisible(page, page.getByRole('button', { name: '색상 팔레트 닫기' }), 'close direct color picker')
    },
  },
  {
    file: '09-tone-color-picker-mobile',
    view: 'tone',
    forceSingle: true,
    setup: async (page) => {
      await clickVisible(page, page.getByRole('tab', { name: '직접 지정' }), 'direct tone color picker')
      await page.locator('#tone-color-picker').waitFor({ state: 'visible' })
    },
  },
  { file: '10-style-mobile', view: 'style', alwaysSuffix: true },
  {
    file: '10-style-shape-input-mobile',
    view: 'style',
    alwaysSuffix: true,
    setup: async (page) => {
      await clickVisible(page, page.locator('.logo-style-option').filter({ hasText: '심볼마크' }), 'style shape input')
      await page.locator('#logo-shape-prompt').fill('둥근 별 모양')
    },
  },
  { file: '11-final-mobile', view: 'final', alwaysSuffix: true },
  { file: '12-logo-loading-mobile', view: 'loading', alwaysSuffix: true, allowLoading: true },
  { file: '13-trademark-loading-mobile', view: 'trademark-loading', alwaysSuffix: true, allowLoading: true },
  { file: '14-trademark-selection-mobile', view: 'trademark-selection', alwaysSuffix: true },
  { file: '15-trademark-result-mobile', view: 'trademark-result', alwaysSuffix: true },
  { file: '16-logo-result-mobile', view: 'result', alwaysSuffix: true },
  {
    file: '17-brand-kit-mobile',
    view: 'brand-kit',
    forceSingle: true,
    allowResultInstead: true,
  },
  {
    file: '17-business-card-modal-mobile',
    view: 'brand-kit',
    forceSingle: true,
    setup: async (page) => {
      const result = page.locator('.brand-kit-result-preview img[src]')
      if (await result.count()) return
      await clickVisible(page, page.getByRole('radio', { name: /명함/ }), 'brand-kit business card selection')
      // This opens a local form only. The costly form submit button is never clicked.
      await clickVisible(page, page.locator('.brand-kit-create-button'), 'open business card modal')
      await page.getByRole('dialog', { name: /명함에 들어갈 정보를 알려주세요/ }).waitFor({ state: 'visible' })
    },
    allowResultInstead: true,
  },
  { file: '18-logo-editor-mobile', view: 'edit', alwaysSuffix: true },
  { file: '19-mypage-mobile', view: 'mypage', alwaysSuffix: true },
  { file: '20-survey-mobile', view: 'survey', alwaysSuffix: true },
]

const makePositions = (height) => {
  const maxScroll = Math.max(0, height - VIEWPORT.height)
  const positions = [0]
  for (let offset = SCROLL_STEP; offset < maxScroll; offset += SCROLL_STEP) positions.push(offset)
  if (maxScroll > 0 && positions.at(-1) !== maxScroll) positions.push(maxScroll)
  return positions
}

const removeExistingCaptures = async (screen) => {
  const escaped = screen.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}(?:-\\d{2})?\\.png$`)
  const entries = await fs.readdir(outputDir)
  await Promise.all(entries.filter((entry) => pattern.test(entry)).map((entry) => fs.rm(path.join(outputDir, entry))))
}

const measureDocument = (page) => page.evaluate(() => {
  const body = document.body
  const html = document.documentElement
  return {
    innerHeight: window.innerHeight,
    height: Math.max(
      window.innerHeight,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      html?.scrollHeight ?? 0,
      html?.offsetHeight ?? 0,
    ),
  }
})

const inspectPageState = (page) => page.evaluate(({ loadingSource, errorSource }) => {
  const visible = (element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }
  const text = document.body?.innerText ?? ''
  const brokenImages = Array.from(document.images)
    .filter((image) => visible(image) && image.complete && image.naturalWidth === 0)
    .map((image) => image.currentSrc || image.src || image.alt || '(unknown image)')
  const loadingElements = Array.from(document.querySelectorAll('[aria-busy="true"], [role="status"], .loading, .spinner'))
    .filter(visible)
    .map((element) => (element.textContent || element.getAttribute('aria-label') || '').trim())
    .filter((value) => new RegExp(loadingSource, 'i').test(value))
  return {
    title: document.title,
    browserErrorPlaceholder: new RegExp(errorSource, 'i').test(`${document.title}\n${text}`),
    brokenImages,
    loadingElements,
    brandKitResultUrls: Array.from(document.querySelectorAll('.brand-kit-result-preview img[src]')).map((image) => image.src),
  }
}, { loadingSource: LOADING_TEXT.source, errorSource: ERROR_PLACEHOLDER.source })

const frameRawCapture = async (browser, rawPath, outputPath) => {
  const context = await browser.newContext({ viewport: FRAME_VIEWPORT, deviceScaleFactor: 1 })
  const page = await context.newPage()
  try {
    const frameUrl = new URL(pathToFileURL(framePath).href)
    frameUrl.searchParams.set('src', pathToFileURL(rawPath).href)
    await page.goto(frameUrl.href, { waitUntil: 'load' })
    await page.locator('#capture').evaluate((image) => image.decode())
    await page.screenshot({ path: outputPath, omitBackground: true })
  } finally {
    await context.close()
  }
}

const validatePng = async (sharp, pngPath) => {
  const image = sharp(pngPath)
  const metadata = await image.metadata()
  const stats = await image.stats()
  const corner = await image.extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer()
  const colorVariation = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0)
  const failures = []
  if (metadata.width !== FRAME_VIEWPORT.width || metadata.height !== FRAME_VIEWPORT.height) {
    failures.push(`unexpected size ${metadata.width}x${metadata.height}`)
  }
  if (metadata.hasAlpha !== true || corner[3] !== 0) failures.push('transparent outer corner missing')
  if (colorVariation < 3) failures.push(`image appears blank (variation ${colorVariation.toFixed(2)})`)
  return { path: pngPath, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha, cornerAlpha: corner[3], colorVariation, failures }
}

const captureState = async ({ chromium, sharp, browser, screen, attempt }) => {
  if (attempt === 1) await removeExistingCaptures(screen)
  const blockedRequests = []
  const consoleErrors = []
  const pageErrors = []
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const risky = MUTATION_METHODS.has(method) && RISKY_ENDPOINT.test(request.url())
    if (risky) {
      blockedRequests.push({ method, url: request.url(), screen: screen.file })
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })

  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  try {
    const url = `${baseUrl}/?view=${encodeURIComponent(screen.view)}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(WAIT_AFTER_NAVIGATION_MS)
    await page.evaluate(() => window.scrollTo(0, 0))

    if (screen.setup) {
      try {
        await screen.setup(page)
      } catch (error) {
        if (!screen.allowResultInstead || !(await page.locator('.brand-kit-result-preview img[src]').count())) throw error
      }
    }
    await page.waitForTimeout(WAIT_AFTER_NAVIGATION_MS)
    await page.evaluate(() => window.scrollTo(0, 0))

    const pageState = await inspectPageState(page)
    const measurement = await measureDocument(page)
    const positions = screen.forceSingle ? [0] : makePositions(measurement.height)
    const captures = []

    for (let index = 0; index < positions.length; index += 1) {
      const scrollTop = positions[index]
      await page.evaluate((top) => window.scrollTo(0, top), scrollTop)
      await page.waitForTimeout(120)
      const suffix = screen.alwaysSuffix || positions.length > 1 ? `-${String(index + 1).padStart(2, '0')}` : ''
      const rawPath = path.join(rawDir, `${screen.file}${suffix}-attempt-${attempt}.png`)
      const outputPath = path.join(outputDir, `${screen.file}${suffix}.png`)
      await page.screenshot({ path: rawPath })
      await frameRawCapture(browser, rawPath, outputPath)
      captures.push(await validatePng(sharp, outputPath))
    }

    const validationFailures = [
      ...(pageState.browserErrorPlaceholder ? ['browser error placeholder detected'] : []),
      ...pageState.brokenImages.map((value) => `broken image: ${value}`),
      ...(screen.allowLoading ? [] : pageState.loadingElements.map((value) => `unwanted loading state: ${value}`)),
      ...pageErrors.map((value) => `page error: ${value}`),
      ...captures.flatMap((capture) => capture.failures.map((failure) => `${path.basename(capture.path)}: ${failure}`)),
    ]

    return {
      screen: screen.file,
      view: screen.view,
      url,
      attempt,
      measurement,
      positions,
      captures,
      blockedRequests,
      consoleErrors,
      pageErrors,
      pageState,
      validationFailures,
      passed: validationFailures.length === 0,
    }
  } finally {
    await context.close()
  }
}

await fs.mkdir(outputDir, { recursive: true })
await fs.mkdir(rawDir, { recursive: true })

const [{ chromium }, sharpModule] = await Promise.all([
  importFirstAvailable('playwright'),
  importFirstAvailable('sharp'),
])
const sharp = sharpModule.default ?? sharpModule
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.GENMARK_CAPTURE_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const results = []
const onlyScreenFilters = onlyScreenFilter.split(',').map((value) => value.trim()).filter(Boolean)
const selectedScreens = onlyScreenFilter
  ? screens.filter((screen) => onlyScreenFilters.includes(screen.file) || onlyScreenFilters.includes(screen.view))
  : screens

if (selectedScreens.length === 0) throw new Error(`No capture state matched GENMARK_CAPTURE_ONLY=${onlyScreenFilter}`)

try {
  for (const screen of selectedScreens) {
    let result = await captureState({ chromium, sharp, browser, screen, attempt: 1 })
    if (!result.passed) result = await captureState({ chromium, sharp, browser, screen, attempt: 2 })
    results.push(result)
    console.log(`[capture] ${screen.file}: ${result.passed ? 'PASS' : 'FAIL'} (${result.captures.length} PNG${result.captures.length === 1 ? '' : 's'}, attempt ${result.attempt})`)
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewport: VIEWPORT,
    frameViewport: FRAME_VIEWPORT,
    waitAfterNavigationMs: WAIT_AFTER_NAVIGATION_MS,
    scrollStep: SCROLL_STEP,
    overlap: VIEWPORT.height - SCROLL_STEP,
    screens: results.map(({ screen, view, url, measurement, positions, captures, pageState }) => ({
      screen,
      view,
      url,
      measurement,
      positions,
      files: captures.map((capture) => path.relative(root, capture.path)),
      brandKitResultUrls: pageState.brandKitResultUrls,
    })),
  }
  const report = {
    generatedAt: manifest.generatedAt,
    passed: results.every((result) => result.passed),
    summary: {
      states: results.length,
      pngs: results.reduce((sum, result) => sum + result.captures.length, 0),
      failedStates: results.filter((result) => !result.passed).map((result) => result.screen),
      retriedStates: results.filter((result) => result.attempt === 2).map((result) => result.screen),
      blockedRequests: results.flatMap((result) => result.blockedRequests),
    },
    results,
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report.summary, null, 2))
  if (!report.passed) process.exitCode = 1
} finally {
  await browser.close()
  await fs.rm(rawDir, { recursive: true, force: true })
}
