import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type AnimatedGalleryProps = {
  children?: ReactNode
}

const IMAGES_1 = [
  'https://images.unsplash.com/photo-1529218402470-5dec8fea0761?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1604928141064-207cea6f571f?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=900&auto=format&fit=crop&q=80',
]

const IMAGES_2 = [
  'https://images.unsplash.com/photo-1542052125323-e69ad37a47c2?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1564284369929-026ba231f89b?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1532236204992-f5e85c024202?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493515322954-4fa727e97985?w=900&auto=format&fit=crop&q=80',
]

const IMAGES_3 = [
  'https://images.unsplash.com/photo-1528361237150-8a9a7df33035?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493515322954-4fa727e97985?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1608875004752-2fdb6a39ba4c?w=900&auto=format&fit=crop&q=80',
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
