import { chromium } from 'file:///C:/Users/SMHRD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const outDir = path.join(root, 'output', 'screen-spec', 'assets', 'all')
await fs.mkdir(outDir, { recursive: true })

const baseUrl = 'http://localhost'
const adminDemoUrl = 'file:///C:/Users/SMHRD/Desktop/%EC%B5%9C%EC%A2%85%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/GenMark_AI/admin-demo/GenMark_Admin_Demo.html'
const userScreens = [
  ['USR-01', 'hero', '첫 진입 화면', null],
  ['USR-02', 'home', '홈 화면', null],
  ['USR-03', 'login', '로그인', null],
  ['USR-04', 'onboarding', '온보딩 - 사용처 선택', null],
  ['USR-05', 'onboarding', '온보딩 - 방문 목적', async (page) => { await page.locator('.onboarding-next').click(); await page.waitForTimeout(1400) }],
  ['USR-06', 'industry', '업종 선택', null],
  ['USR-07', 'choice', 'CI·BI 선택', null],
  ['USR-08', 'choice', 'CI·BI 안내', async (page) => { await page.locator('.brand-choice-info').first().click(); await page.waitForTimeout(200) }],
  ['USR-09', 'brand-details', 'BI 브랜드 정보 입력', null],
  ['USR-10', 'company-details', 'CI 기업 정보 입력', null],
  ['USR-11', 'tone', '톤·색상 선택', null],
  ['USR-12', 'style', '로고 스타일 선택', null],
  ['USR-13', 'final', '최종 요청 검토', null],
  ['USR-14', 'loading', '로고 생성 대기', null],
  ['USR-15', 'result', '로고 생성 결과', null],
  ['USR-16', 'trademark-selection', '상표 이미지 분석 선택', null],
  ['USR-17', 'trademark-loading', '상표 이미지 분석 대기', null],
  ['USR-18', 'trademark-result', '상표 이미지 분석 결과', null],
  ['USR-19', 'edit', '로고 편집', null],
  ['USR-20', 'brand-kit', '브랜드 키트 선택', null],
  ['USR-21', 'mypage', '마이페이지', null],
  ['USR-22', 'survey', '만족도 설문', null],
]

const adminScreens = [
  ['ADM-01', '/admin/?view=dashboard&tab=overview', '관리자 로그인', false],
  ['ADM-02', '/admin/?view=dashboard&tab=overview', '관리자 대시보드', true],
  ['ADM-03', '/admin/?view=dashboard&tab=members', '회원 목록', true],
  ['ADM-04', '/admin/?view=dashboard&tab=signup', '가입 통계', true],
  ['ADM-05', '/admin/?view=dashboard&tab=generation', '생성 통계', true],
  ['ADM-06', '/admin/?view=dashboard&tab=download', '다운로드 통계', true],
  ['ADM-07', '/admin/?view=dashboard&tab=credits', '크레딧 통계', true],
  ['ADM-08', '/admin/?view=dashboard&tab=requests', '개선 요청', true],
]

const labelOf = (element) => {
  const aria = element.getAttribute('aria-label')
  const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim()
  const placeholder = element.getAttribute('placeholder')
  return aria || text || placeholder || element.getAttribute('title') || element.tagName.toLowerCase()
}

const collectTargets = async (page) => page.evaluate(() => {
  const root = document.querySelector('main') || document.body
  const candidates = Array.from(root.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="tab"], [role="radio"]'))
  const navCandidates = Array.from(document.querySelectorAll('nav.bottom-nav button'))
  const unique = [...new Set([...candidates, ...navCandidates])]
  return unique
    .map((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      if (!visible) return null
      const aria = element.getAttribute('aria-label')
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim()
      const placeholder = element.getAttribute('placeholder')
      const label = aria || text || placeholder || element.getAttribute('title') || element.tagName.toLowerCase()
      return {
        label: label.slice(0, 90),
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        disabled: Boolean(element.disabled),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      }
    })
    .filter(Boolean)
})

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1350 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})

for (const [id, view, name, setup] of userScreens) {
  const page = await context.newPage()
  await page.goto(`${baseUrl}/?view=${encodeURIComponent(view)}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  if (setup) await setup(page)
  await page.waitForTimeout(250)

  const documentHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
  const fitScale = Math.min(1, 1320 / Math.max(1, documentHeight))
  if (fitScale < 1) {
    await page.addStyleTag({ content: `html { zoom: ${fitScale}; }` })
    await page.waitForTimeout(100)
  }
  const targets = await collectTargets(page)
  await page.screenshot({ path: path.join(outDir, `${id}.png`), fullPage: false })
  await fs.writeFile(path.join(outDir, `${id}.json`), JSON.stringify({ id, name, route: `/?view=${view}`, fitScale, viewport: { width: 1440, height: 1350 }, targets }, null, 2), 'utf8')
  await page.close()
}

for (const [id, route, name, authenticated] of adminScreens) {
  const page = await context.newPage()
  if (!authenticated) {
    await page.addInitScript(() => localStorage.removeItem('genmark-admin-access-token'))
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
  } else {
    await page.goto(`${adminDemoUrl}?tab=${new URL(`${baseUrl}${route}`).searchParams.get('tab')}`, { waitUntil: 'load' })
  }
  await page.waitForTimeout(500)
  const documentHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
  const fitScale = Math.min(1, 1320 / Math.max(1, documentHeight))
  if (fitScale < 1) {
    await page.addStyleTag({ content: `html { zoom: ${fitScale}; }` })
    await page.waitForTimeout(100)
  }
  const targets = await collectTargets(page)
  await page.screenshot({ path: path.join(outDir, `${id}.png`), fullPage: false })
  await fs.writeFile(path.join(outDir, `${id}.json`), JSON.stringify({ id, name, route, fitScale, viewport: { width: 1440, height: 1350 }, targets }, null, 2), 'utf8')
  await page.close()
}

await browser.close()
console.log(JSON.stringify({ output: outDir, screens: userScreens.length + adminScreens.length }))
