import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type AnimatedGalleryProps = {
  children?: ReactNode
}

const BRAND_CARDS_IMAGE = '/beauty-brand-cards.png'
const SKINCARE_PRODUCTS_IMAGE = '/beauty-skincare-products.png'

// Each source image is a 4 × 3 contact sheet. Matching cells share the same
// palette and brand, so a gallery tile can transition between the card and its
// corresponding product shot without changing the existing gallery movement.
const IMAGE_COLUMNS = [
  [0, 5, 10, 3],
  [1, 6, 9, 4],
  [2, 7, 8, 11],
]

const BRAND_NAMES = [
  'VELORA', 'VERDALE', 'ROSÉMIA', 'AURION',
  'MORVAN', 'ELORIS', 'NEVIA', 'YUNOA',
  'SOLEN', 'VITARA', 'ZENITH', 'AQUELLE',
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const frameStyle: CSSProperties = {
  position: 'relative',
  flex: '0 0 auto',
  width: '100%',
  aspectRatio: '1.72 / 1',
  overflow: 'hidden',
  borderRadius: 6,
  background: '#e9e4df',
  boxShadow: '0 6px 16px rgb(48 37 104 / .12)',
}

const getSliceStyle = (tileIndex: number): CSSProperties => {
  const column = tileIndex % 4
  const row = Math.floor(tileIndex / 4)

  return {
    position: 'absolute',
    left: `${column * -100}%`,
    top: `${-(26.4 + row * 152.9)}%`,
    display: 'block',
    width: '400%',
    maxWidth: 'none',
    height: 'auto',
    aspectRatio: 'auto',
    borderRadius: 0,
    objectFit: 'fill',
    boxShadow: 'none',
    filter: 'none',
  }
}

function MatchedGalleryImage({ tileIndex, sequence }: { tileIndex: number; sequence: number }) {
  const sliceStyle = getSliceStyle(tileIndex)

  return (
    <div
      className="animated-gallery-matched-image"
      style={frameStyle}
      role="img"
      aria-label={`${BRAND_NAMES[tileIndex]} 브랜드 명함과 스킨케어 제품 이미지`}
    >
      <img src={BRAND_CARDS_IMAGE} alt="" aria-hidden="true" style={sliceStyle} />
      <img
        src={SKINCARE_PRODUCTS_IMAGE}
        alt=""
        aria-hidden="true"
        className="animated-gallery-product-layer"
        style={{ ...sliceStyle, animationDelay: `${sequence * -1.35}s` }}
      />
    </div>
  )
}

function GalleryColumn({ tileIndexes, className, sequenceOffset }: { tileIndexes: number[]; className: string; sequenceOffset: number }) {
  return (
    <div className={`animated-gallery-column ${className}`}>
      {tileIndexes.map((tileIndex, index) => (
        <MatchedGalleryImage key={tileIndex} tileIndex={tileIndex} sequence={sequenceOffset + index} />
      ))}
    </div>
  )
}

export default function AnimatedGallery({ children }: AnimatedGalleryProps) {
  const scrollRef = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const section = scrollRef.current
    if (!section) return

    let frame = 0
    const update = () => {
      frame = 0
      const rect = section.getBoundingClientRect()
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight)
      setProgress(clamp(-rect.top / scrollable, 0, 1))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const style = {
    // The source demo uses a stronger 75° tilt. A gentler initial tilt keeps
    // the first viewport readable while preserving the same scroll-to-flat motion.
    '--gallery-rotate': `${32 - progress * 32}deg`,
    '--gallery-scale': `${1.06 - progress * 0.06}`,
    '--gallery-y': `${progress * -7}%`,
  } as CSSProperties

  return (
    <section ref={scrollRef} className="animated-gallery-hero" style={style}>
      <style>{`
        @keyframes matched-gallery-crossfade {
          0%, 36% { opacity: 0; }
          48%, 88% { opacity: 1; }
          100% { opacity: 0; }
        }

        .animated-gallery-product-layer {
          opacity: 0;
          animation: matched-gallery-crossfade 16.2s ease-in-out infinite;
          will-change: opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .animated-gallery-product-layer { animation: none; opacity: .52; }
        }
      `}</style>
      {children}
      <div className="animated-gallery-glow" aria-hidden="true" />
      <div className="animated-gallery-sticky">
        <div className="animated-gallery-stage">
          <GalleryColumn tileIndexes={IMAGE_COLUMNS[0]} className="animated-gallery-column-left" sequenceOffset={0} />
          <GalleryColumn tileIndexes={IMAGE_COLUMNS[1]} className="animated-gallery-column-center" sequenceOffset={4} />
          <GalleryColumn tileIndexes={IMAGE_COLUMNS[2]} className="animated-gallery-column-right" sequenceOffset={8} />
        </div>
      </div>
    </section>
  )
}
