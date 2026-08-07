import { CSSProperties, useEffect, useRef } from 'react'

type FocalPoint = { x: number; y: number }

type CopperplateHatchProps = {
  className?: string
  style?: CSSProperties
  density?: number
  intensity?: number
  speed?: number
  focalPoint?: FocalPoint
  accent?: string
  interactive?: boolean
  reducedMotion?: boolean
}

type Stroke = { x: number; y: number; angle: number; phase: number; weight: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function parseColor(value: string) {
  const match = value.trim().match(/^#?([\da-f]{6})$/i)
  if (!match) return [234, 179, 101] as const
  const number = Number.parseInt(match[1], 16)
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255] as const
}

export function CopperplateHatch({
  className = '',
  style,
  density = 1,
  intensity = 1,
  speed = 0.45,
  focalPoint = { x: 0.62, y: 0.42 },
  accent = '#eab365',
  interactive = true,
  reducedMotion = false,
}: CopperplateHatchProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!host || !canvas || !context) return

    let width = 1
    let height = 1
    let dpr = 1
    let frame = 0
    let start = 0
    let strokes: Stroke[] = []
    let pointer = { x: focalPoint.x, y: focalPoint.y, active: false }
    const [goldR, goldG, goldB] = parseColor(accent)
    const angles = [0.56, -0.56, Math.PI / 2]

    const rebuild = () => {
      const rect = host.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const step = clamp(26 / Math.max(0.4, density), 14, 34)
      const random = seededRandom(71337)
      const columns = Math.ceil(width / step) + 3
      const rows = Math.ceil(height / step) + 3
      const perLayerCap = columns * rows
      strokes = []
      angles.forEach((angle, layer) => {
        let count = 0
        for (let y = -step; y < height + step && count < perLayerCap; y += step) {
          const offset = (Math.round(y / step) % 2) * step * 0.5
          for (let x = -step + offset; x < width + step && count < perLayerCap; x += step) {
            strokes.push({ x, y, angle, phase: random() * Math.PI * 2, weight: 0.65 + layer * 0.22 })
            count += 1
          }
        }
      })
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (time: number) => {
      if (!start) start = time
      const elapsed = (time - start) / 1000
      const motion = reducedMotion ? 7.3 : elapsed * speed
      const targetX = pointer.active ? pointer.x : focalPoint.x
      const targetY = pointer.active ? pointer.y : focalPoint.y
      const fx = targetX * width
      const fy = targetY * height
      const [inkR, inkG, inkB] = [158, 163, 196]

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.globalCompositeOperation = 'source-over'
      context.fillStyle = '#080b18'
      context.fillRect(0, 0, width, height)

      const wash = context.createRadialGradient(fx, fy, 0, fx, fy, Math.max(width, height) * 0.86)
      wash.addColorStop(0, `rgba(${goldR},${goldG},${goldB},${0.14 * intensity})`)
      wash.addColorStop(0.45, 'rgba(34,43,108,0.24)')
      wash.addColorStop(1, 'rgba(3,5,20,0.85)')
      context.fillStyle = wash
      context.fillRect(0, 0, width, height)

      context.lineCap = 'round'
      const waveA = ((motion * 120) % (Math.hypot(width, height) + 360)) - 180
      const waveB = ((motion * 120 + 420) % (Math.hypot(width, height) + 360)) - 180
      const viewportScale = clamp(Math.min(width, height) / 430, 0.95, 2.3)
      const haloRadius = 260 * viewportScale
      const glintRadius = 74 * viewportScale
      for (const stroke of strokes) {
        const dx = stroke.x - fx
        const dy = stroke.y - fy
        const distance = Math.hypot(dx, dy)
        const halo = Math.exp(-(distance * distance) / (2 * haloRadius * haloRadius))
        const glintA = Math.exp(-((distance - waveA) ** 2) / (2 * glintRadius * glintRadius))
        const glintB = Math.exp(-((distance - waveB) ** 2) / (2 * glintRadius * glintRadius)) * 0.72
        const glint = Math.max(glintA, glintB)
        const visibility = 0.22 + halo * 0.22 + glint * 0.66
        if (visibility < 0.07) continue

        const half = 8 + stroke.weight * 4
        const wave = Math.sin(stroke.x * 0.009 + stroke.y * 0.005 + stroke.phase + motion * 0.2) * 1.8
        const cos = Math.cos(stroke.angle)
        const sin = Math.sin(stroke.angle)
        const x1 = stroke.x - cos * half + wave
        const y1 = stroke.y - sin * half
        const x2 = stroke.x + cos * half + wave
        const y2 = stroke.y + sin * half
        if (glint > 0.06) {
          context.strokeStyle = `rgba(${goldR},${Math.min(255, goldG + glint * 42)},${Math.min(255, goldB + glint * 84)},${clamp(visibility * intensity, 0, 0.9)})`
        } else {
          context.strokeStyle = `rgba(${inkR},${inkG},${inkB},${clamp(visibility * intensity * 0.9, 0, 0.56)})`
        }
        context.lineWidth = 0.8 + glint * 1.15
        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.stroke()
      }

      const quietStrength = 0.12
      const quietRadius = Math.min(width * 0.38, height * 0.64)
      const quiet = context.createRadialGradient(width * 0.27, height * 0.55, 0, width * 0.27, height * 0.55, quietRadius)
      quiet.addColorStop(0, `rgba(5,7,23,${quietStrength})`)
      quiet.addColorStop(0.58, `rgba(5,7,23,${quietStrength * 0.46})`)
      quiet.addColorStop(1, 'rgba(5,7,23,0)')
      context.fillStyle = quiet
      context.fillRect(0, 0, width, height)

      if (!reducedMotion) frame = requestAnimationFrame(draw)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointer = { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1), active: true }
    }
    const handlePointerLeave = () => { pointer.active = false }
    if (interactive) {
      host.addEventListener('pointermove', handlePointerMove)
      host.addEventListener('pointerleave', handlePointerLeave)
    }
    const resizeObserver = new ResizeObserver(rebuild)
    resizeObserver.observe(host)
    rebuild()
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      host.removeEventListener('pointermove', handlePointerMove)
      host.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [accent, density, focalPoint.x, focalPoint.y, intensity, interactive, reducedMotion, speed])

  return (
    <div ref={hostRef} className={`copperplate-hatch ${className}`} style={style} aria-hidden="true">
      <canvas ref={canvasRef} className="copperplate-hatch-canvas" />
    </div>
  )
}

export default CopperplateHatch
