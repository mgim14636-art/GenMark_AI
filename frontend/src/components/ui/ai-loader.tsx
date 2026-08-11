import type { HTMLAttributes } from 'react'

type AiLoaderProps = HTMLAttributes<HTMLDivElement> & {
  label?: string
}

/** Animated logo-generation indicator used by the loading flow. */
export const AiLoader = ({ label = 'Generating', className = '', ...props }: AiLoaderProps) => (
  <div className={`ai-loader ${className}`.trim()} role="status" aria-label={label} {...props}>
    <div className="loader-wrapper">
      <div className="loader" aria-hidden="true" />
      <span className="loader-copy" aria-hidden="true">
        {Array.from(label).map((letter, index) => (
          <span className="loader-letter" key={`${letter}-${index}`}>
            {letter === ' ' ? '\u00a0' : letter}
          </span>
        ))}
      </span>
    </div>
  </div>
)

// Kept as an alias so the component can also be used by the supplied demo snippet.
export const Component = AiLoader
