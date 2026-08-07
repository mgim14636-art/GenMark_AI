import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDirectory = dirname(fileURLToPath(import.meta.url))
const buildDirectory = resolve(frontendDirectory, 'admin-demo-build')
const outputDirectory = resolve(frontendDirectory, '..', 'admin-demo')
const outputPath = resolve(outputDirectory, 'GenMark_Admin_Demo.html')

const [css, bundledJavaScript] = await Promise.all([
  readFile(resolve(buildDirectory, 'admin-demo.css'), 'utf8'),
  readFile(resolve(buildDirectory, 'admin-demo.js'), 'utf8'),
])

const safeJavaScript = bundledJavaScript.replaceAll('</script', '<\\/script')
const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>GenMark AI 관리자 화면 데모</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <noscript>이 관리자 화면 데모를 보려면 브라우저에서 JavaScript를 활성화해주세요.</noscript>
    <script>${safeJavaScript}</script>
  </body>
</html>
`

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, html, 'utf8')

console.log(`Created ${outputPath}`)
