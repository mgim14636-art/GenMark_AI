import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type AnimatedGalleryProps = {
  children?: ReactNode
}

const IMAGES_1 = [
  '/hero-gallery/zevora.png',
  '/hero-gallery/solvane.png',
  '/hero-gallery/orbit-red.png',
  '/hero-gallery/novaire.png',
  '/hero-gallery/interlace.png',
]

const IMAGES_2 = [
  '/hero-gallery/velora.png',
  '/hero-gallery/red-monogram.png',
  '/hero-gallery/velune.png',
  '/hero-gallery/aurelia-crest.png',
  '/hero-gallery/velune-profile.png',
]

const IMAGES_3 = [
  '/hero-gallery/leaf-symbol.png',
  '/hero-gallery/novaire-wordmark.png',
  '/hero-gallery/aurelia-emblem.png',
  '/hero-gallery/ar-monogram.png',
  '/hero-gallery/lk-monogram.png',
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function GalleryColumn({ images, className, style }: { images: string[]; className: string; style?: CSSProperties }) {
  return (
    <div className={`animated-gallery-column ${className}`} style={style}>
      {images.map((image, index) => (
        <img key={`${image}-${index}`} src={image} alt="도쿄의 브랜드 영감 이미지" loading={index > 1 ? 'lazy' : 'eager'} />
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
      {children}
      <div className="animated-gallery-glow" aria-hidden="true" />
      <div className="animated-gallery-sticky">
        <div className="animated-gallery-stage">
          <GalleryColumn images={IMAGES_1} className="animated-gallery-column-left" />
          <GalleryColumn images={IMAGES_2} className="animated-gallery-column-center" />
          <GalleryColumn images={IMAGES_3} className="animated-gallery-column-right" />
        </div>
      </div>
    </section>
  )
}
