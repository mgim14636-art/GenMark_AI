export type SvgEdits = {
  target: 'symbol' | 'text'
  color?: string
  scale: number
  rotation: number
  opacity: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const EDITOR_WRAPPER = 'data-genmark-editor'
const DANGEROUS_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'style'])
const PAINT_ATTRIBUTES = new Set(['fill', 'stroke', 'stop-color'])
const FILL_SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon'])
const STROKE_SHAPES = new Set(['line', 'polyline'])

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

const applyColor = (root: SVGSVGElement, color: string) => {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const hasExplicitShapePaint = element.hasAttribute('fill') || element.hasAttribute('stroke')
    for (const name of PAINT_ATTRIBUTES) {
      const value = element.getAttribute(name)?.trim()
      if (!value || /^(none|transparent)$/i.test(value) || /^url\(/i.test(value)) continue
      element.setAttribute(name, color)
    }
    const elementName = element.localName.toLowerCase()
    if (!hasExplicitShapePaint && FILL_SHAPES.has(elementName)) element.setAttribute('fill', color)
    if (!hasExplicitShapePaint && STROKE_SHAPES.has(elementName)) element.setAttribute('stroke', color)
  }
}

export const buildEditedSvg = (source: string, edits: SvgEdits) => {
  const { document, root } = sanitizeDocument(source)
  const targetId = edits.target === 'symbol' ? 'symbol' : 'wordmark'
  const matchedTarget = root.querySelector(`#${targetId}`)
  if (edits.target === 'text' && !matchedTarget) {
    throw new Error('이 SVG에는 편집 가능한 글자 요소가 없어요.')
  }
  const target = matchedTarget ?? root
  unwrapPreviousEdit(target, edits.target)
  if (edits.color) applyColor(target as unknown as SVGSVGElement, edits.color)

  const wrapper = document.createElementNS(SVG_NS, 'g')
  wrapper.setAttribute(EDITOR_WRAPPER, edits.target)
  const { x, y } = canvasCenter(root as unknown as SVGSVGElement)
  const scale = clamp(edits.scale, 10, 300) / 100
  const rotation = clamp(edits.rotation, -360, 360)
  wrapper.setAttribute(
    'transform',
    `translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(${-x} ${-y})`,
  )
  wrapper.setAttribute('opacity', String(clamp(edits.opacity, 0, 100) / 100))

  const nonVisual = new Set(['defs', 'title', 'desc', 'metadata'])
  const visibleChildren = Array.from(target.children).filter(
    (child) => !nonVisual.has(child.localName.toLowerCase()),
  )
  for (const child of visibleChildren) wrapper.appendChild(child)
  target.appendChild(wrapper)

  return new XMLSerializer().serializeToString(root)
}
