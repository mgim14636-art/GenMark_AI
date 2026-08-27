export type SvgEdits = {
  target: string
  color?: string
  scale: number
  rotation: number
  opacity: number
  offsetX: number
  offsetY: number
  removed?: boolean
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const EDITOR_WRAPPER = 'data-genmark-editor'
const EDITOR_ELEMENT = 'data-genmark-editor-element'
const EDITOR_SELECTED = 'data-genmark-selected'
const DANGEROUS_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'style'])
const PAINT_ATTRIBUTES = new Set(['fill', 'stroke', 'stop-color'])
const FILL_SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon'])
const STROKE_SHAPES = new Set(['line', 'polyline'])
const NON_VISUAL_ELEMENTS = new Set(['defs', 'title', 'desc', 'metadata'])

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

const isExternalReference = (value: string) => {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '')
  return Boolean(normalized) && !normalized.startsWith('#')
}

const hasExternalUrl = (value: string) => /url\(\s*['"]?(?!#)/i.test(value)

const sanitizeDocument = (source: string) => {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.querySelector('parsererror')) throw new Error('SVG 형식을 해석하지 못했어요.')

  const root = document.documentElement
  if (root.localName.toLowerCase() !== 'svg') throw new Error('SVG 루트 요소가 없어요.')

  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (DANGEROUS_ELEMENTS.has(element.localName.toLowerCase())) {
      element.remove()
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (
        name.startsWith('on')
        || name === 'style'
        || /^javascript:/i.test(value)
        || hasExternalUrl(value)
        || ((name === 'href' || name.endsWith(':href') || name === 'src') && isExternalReference(value))
      ) {
        element.removeAttributeNode(attribute)
      }
    }
  }

  for (const attribute of Array.from(root.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value.trim()
    if (name.startsWith('on') || name === 'style' || /^javascript:/i.test(value) || hasExternalUrl(value)) {
      root.removeAttributeNode(attribute)
    }
  }

  return { document, root }
}

const unwrapPreviousEdit = (target: Element, editTarget: SvgEdits['target']) => {
  const wrapper = Array.from(target.children).find(
    (child) => child.getAttribute(EDITOR_WRAPPER) === editTarget,
  )
  if (!wrapper) return
  while (wrapper.firstChild) target.insertBefore(wrapper.firstChild, wrapper)
  wrapper.remove()
}

const canvasCenter = (root: SVGSVGElement) => {
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return { x: viewBox[0] + viewBox[2] / 2, y: viewBox[1] + viewBox[3] / 2 }
  }

  const width = Number.parseFloat(root.getAttribute('width') ?? '') || 512
  const height = Number.parseFloat(root.getAttribute('height') ?? '') || 512
  return { x: width / 2, y: height / 2 }
}

const applyColor = (root: Element, color: string) => {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const hasExplicitShapePaint = element.hasAttribute('fill') || element.hasAttribute('stroke')
    for (const name of PAINT_ATTRIBUTES) {
      const value = element.getAttribute(name)?.trim()
      if (!value || /^(none|transparent)$/i.test(value)) continue
      element.setAttribute(name, color)
    }
    const elementName = element.localName.toLowerCase()
    if (!hasExplicitShapePaint && FILL_SHAPES.has(elementName)) element.setAttribute('fill', color)
    if (!hasExplicitShapePaint && STROKE_SHAPES.has(elementName)) element.setAttribute('stroke', color)
  }
}

const elementCenterY = (element: Element, viewBoxHeight: number) => {
  const transform = element.getAttribute('transform') ?? ''
  const translatedY = transform.match(/translate\(\s*[-+\d.e]+[\s,]+([-+\d.e]+)/i)?.[1]
  if (translatedY) {
    const value = Number(translatedY)
    if (Number.isFinite(value)) return value
  }

  const pathData = element.getAttribute('d')
    ?? element.querySelector('[d]')?.getAttribute('d')
    ?? ''
  const numbers = pathData.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? []
  if (numbers.length < 2) return viewBoxHeight / 2
  const yValues = numbers.filter((_, index) => index % 2 === 1)
  if (yValues.length === 0 || yValues.some((value) => !Number.isFinite(value))) return viewBoxHeight / 2
  return (Math.min(...yValues) + Math.max(...yValues)) / 2
}

const ensureEditableGroups = (root: SVGSVGElement) => {
  if (root.querySelector('#symbol') || root.querySelector('#wordmark')) return

  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  const viewBoxHeight = viewBox?.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3] : 2048
  const visibleChildren = Array.from(root.children).filter(
    (child) => !NON_VISUAL_ELEMENTS.has(child.localName.toLowerCase()),
  )
  if (visibleChildren.length < 2) return

  const symbolChildren: Element[] = []
  const wordmarkChildren: Element[] = []
  visibleChildren.forEach((child) => {
    const centerY = elementCenterY(child, viewBoxHeight)
    if (centerY >= viewBoxHeight * 0.56) wordmarkChildren.push(child)
    else symbolChildren.push(child)
  })
  if (symbolChildren.length === 0 || wordmarkChildren.length === 0) return

  const symbol = root.ownerDocument!.createElementNS(SVG_NS, 'g')
  symbol.setAttribute('id', 'symbol')
  const wordmark = root.ownerDocument!.createElementNS(SVG_NS, 'g')
  wordmark.setAttribute('id', 'wordmark')
  symbolChildren.forEach((child) => symbol.appendChild(child))
  wordmarkChildren.forEach((child) => wordmark.appendChild(child))
  root.append(symbol, wordmark)
}

const editableElementNames = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'line', 'polyline', 'text'])

// 생성된 로고 SVG 중 일부는 viewBox 없이 width/height만 갖는다. 그런 SVG를 편집 캔버스에
// 인라인으로 넣으면 preserveAspectRatio가 동작할 기준이 없어, 정사각형 틀에 원본 픽셀 크기
// 그대로 그려지다 아래쪽(워드마크 등)이 잘린다. 결과 화면은 <img>라서 안 잘리지만 편집
// 화면은 인라인 <svg>라서 잘림. width/height로 viewBox를 만들어 두 화면 동작을 맞춘다.
const ensureViewBox = (root: Element) => {
  const existing = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).filter(Boolean)
  if (existing?.length === 4 && existing.every((value) => Number.isFinite(Number(value)))) return
  const width = Number.parseFloat(root.getAttribute('width') ?? '')
  const height = Number.parseFloat(root.getAttribute('height') ?? '')
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    root.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }
}

const VIEWBOX_CLIP_ID = 'genmark-viewbox-clip'

// 편집 캔버스는 인라인 <svg>라, viewBox 밖에 그려진 요소(생성 로고에 가끔 있는 떨어져 나간
// 글자 등)가 정사각형 틀의 여백까지 삐져나온다. 결과 화면 <img>는 항상 viewBox로 잘라주므로,
// 편집 미리보기도 viewBox 사각형으로 clip해 두 화면을 일치시킨다. (저장본은 건드리지 않는다.)
const clipContentToViewBox = (root: Element) => {
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (!(viewBox?.length === 4 && viewBox.every(Number.isFinite))) return
  if (root.querySelector(`#${VIEWBOX_CLIP_ID}`)) return
  const doc = root.ownerDocument
  if (!doc) return

  const defs = doc.createElementNS(SVG_NS, 'defs')
  const clipPath = doc.createElementNS(SVG_NS, 'clipPath')
  clipPath.setAttribute('id', VIEWBOX_CLIP_ID)
  clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse')
  const rect = doc.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', String(viewBox[0]))
  rect.setAttribute('y', String(viewBox[1]))
  rect.setAttribute('width', String(viewBox[2]))
  rect.setAttribute('height', String(viewBox[3]))
  clipPath.appendChild(rect)
  defs.appendChild(clipPath)

  const wrapper = doc.createElementNS(SVG_NS, 'g')
  wrapper.setAttribute('clip-path', `url(#${VIEWBOX_CLIP_ID})`)
  while (root.firstChild) wrapper.appendChild(root.firstChild)
  root.appendChild(defs)
  root.appendChild(wrapper)
}

const isCanvasBackground = (element: Element, root: SVGSVGElement) => {
  if (element.localName.toLowerCase() !== 'rect') return false
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  const width = viewBox?.length === 4 ? viewBox[2] : Number.parseFloat(root.getAttribute('width') ?? '') || 512
  const height = viewBox?.length === 4 ? viewBox[3] : Number.parseFloat(root.getAttribute('height') ?? '') || 512
  const fill = element.getAttribute('fill')?.trim().toLowerCase()
  return (element.getAttribute('x') ?? '0') === '0'
    && (element.getAttribute('y') ?? '0') === '0'
    && Number.parseFloat(element.getAttribute('width') ?? '') === width
    && Number.parseFloat(element.getAttribute('height') ?? '') === height
    && ['#fff', '#ffffff', 'white'].includes(fill ?? '')
}

const ensureEditableElements = (root: SVGSVGElement) => {
  let sequence = 1
  for (const element of Array.from(root.querySelectorAll('*'))) {
    const name = element.localName.toLowerCase()
    if (!editableElementNames.has(name) || isCanvasBackground(element, root) || element.closest('defs, filter')) continue
    if (!element.getAttribute(EDITOR_ELEMENT)) {
      element.setAttribute(EDITOR_ELEMENT, element.getAttribute('id') || `element-${sequence}`)
    }
    sequence += 1
  }
}

const findEditableElement = (root: SVGSVGElement, target: string) => Array.from(root.querySelectorAll(`[${EDITOR_ELEMENT}]`)).find(
  (element) => element.getAttribute(EDITOR_ELEMENT) === target,
)

const unwrapElementEdit = (root: SVGSVGElement, target: string) => {
  const wrapper = Array.from(root.querySelectorAll(`[${EDITOR_WRAPPER}]`)).find(
    (element) => element.getAttribute(EDITOR_WRAPPER) === target,
  )
  if (!wrapper?.parentElement) return
  while (wrapper.firstChild) wrapper.parentElement.insertBefore(wrapper.firstChild, wrapper)
  wrapper.remove()
}

const inheritedAttribute = (element: Element, attribute: string) => {
  let current: Element | null = element
  while (current) {
    const value = current.getAttribute(attribute)?.trim()
    if (value) return value
    current = current.parentElement
  }
  return ''
}

const elementCenter = (element: Element) => {
  const name = element.localName.toLowerCase()
  const number = (attribute: string) => Number.parseFloat(element.getAttribute(attribute) ?? '') || 0
  if (name === 'circle' || name === 'ellipse') return { x: number('cx'), y: number('cy') }
  if (name === 'rect') return { x: number('x') + number('width') / 2, y: number('y') + number('height') / 2 }
  if (name === 'text') {
    // SVG text의 x/y는 시각적 중앙이 아니라 시작점과 기준선이다.
    // 실제 렌더러의 getBBox()를 사용할 수 없는 직렬화 단계에서는
    // 글자 폭과 기준선으로 시각적 중심을 추정해 회전 중심을 보정한다.
    const content = (element.textContent ?? '').replace(/\s/g, '')
    const fontSize = Number.parseFloat(inheritedAttribute(element, 'font-size')) || 16
    const letterSpacing = Number.parseFloat(inheritedAttribute(element, 'letter-spacing')) || 0
    const declaredLength = Number.parseFloat(element.getAttribute('textLength') ?? '')
    const estimatedWidth = Number.isFinite(declaredLength) && declaredLength > 0
      ? declaredLength
      : Math.max(0, content.length * fontSize * 0.63 + Math.max(0, content.length - 1) * letterSpacing)
    const anchor = inheritedAttribute(element, 'text-anchor').toLowerCase()
    const startX = number('x') - (anchor === 'middle' ? estimatedWidth / 2 : anchor === 'end' ? estimatedWidth : 0)
    return {
      x: startX + estimatedWidth / 2,
      y: number('y') - fontSize * 0.3,
    }
  }
  const values = (element.getAttribute('d') ?? '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? []
  const points = values.reduce<Array<{ x: number; y: number }>>((result, value, index) => {
    if (index % 2 === 0 && Number.isFinite(values[index + 1])) result.push({ x: value, y: values[index + 1] })
    return result
  }, [])
  if (points.length === 0) return { x: 0, y: 0 }
  return {
    x: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2,
    y: (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2,
  }
}

export const prepareEditableSvg = (source: string, selectedTarget?: string | null) => {
  const { root } = sanitizeDocument(source)
  ensureEditableElements(root as unknown as SVGSVGElement)
  ensureViewBox(root)
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  for (const element of Array.from(root.querySelectorAll(`[${EDITOR_ELEMENT}]`))) {
    if (element.getAttribute(EDITOR_ELEMENT) === selectedTarget) element.setAttribute(EDITOR_SELECTED, 'true')
    else element.removeAttribute(EDITOR_SELECTED)
  }
  clipContentToViewBox(root)
  return new XMLSerializer().serializeToString(root)
}

export const buildEditedSvg = (source: string, edits: SvgEdits) => {
  const { document, root } = sanitizeDocument(source)
  ensureEditableElements(root as unknown as SVGSVGElement)
  ensureViewBox(root)
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  unwrapElementEdit(root as unknown as SVGSVGElement, edits.target)
  const target = findEditableElement(root as unknown as SVGSVGElement, edits.target)
  if (!target) throw new Error('선택한 SVG 요소를 찾지 못했어요.')
  if (edits.removed) {
    target.remove()
    return new XMLSerializer().serializeToString(root)
  }
  if (edits.color) applyColor(target, edits.color)

  const wrapper = document.createElementNS(SVG_NS, 'g')
  wrapper.setAttribute(EDITOR_WRAPPER, edits.target)
  const center = elementCenter(target)
  const scale = clamp(edits.scale, 10, 300) / 100
  const rotation = clamp(edits.rotation, -360, 360)
  const offsetX = Number.isFinite(edits.offsetX) ? edits.offsetX : 0
  const offsetY = Number.isFinite(edits.offsetY) ? edits.offsetY : 0
  wrapper.setAttribute('transform', `translate(${offsetX} ${offsetY}) translate(${center.x} ${center.y}) rotate(${rotation}) scale(${scale}) translate(${-center.x} ${-center.y})`)
  wrapper.setAttribute('opacity', String(clamp(edits.opacity, 0, 100) / 100))
  target.parentElement?.insertBefore(wrapper, target)
  wrapper.appendChild(target)

  return new XMLSerializer().serializeToString(root)
}
