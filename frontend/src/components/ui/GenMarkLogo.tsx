type GenMarkLogoProps = {
  className?: string
  alt?: string
}

export default function GenMarkLogo({ className = '', alt = '' }: GenMarkLogoProps) {
  return (
    <img
      className={className ? `genmark-logo ${className}` : 'genmark-logo'}
      src="/genmark-symbol.svg"
      alt={alt}
      aria-hidden={alt ? undefined : true}
    />
  )
}
