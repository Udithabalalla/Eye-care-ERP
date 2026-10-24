import type { CSSProperties } from 'react'

const MASKS = {
  mark: '/brand/logo-mark.png',
  full: '/brand/logo-full.png',
} as const

/**
 * Vision Opticals logo drawn as a CSS mask, so it takes the current text/theme
 * colour (e.g. `text-primary`, `text-sidebar-primary`) in light and dark mode.
 */
const BrandLogo = ({
  variant = 'mark',
  className = '',
  title = 'Vision Opticals',
}: {
  variant?: keyof typeof MASKS
  className?: string
  title?: string
}) => {
  const url = `url(${MASKS[variant]})`
  const style: CSSProperties = {
    backgroundColor: 'currentColor',
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  }
  return <span role="img" aria-label={title} className={`inline-block shrink-0 ${className}`} style={style} />
}

export default BrandLogo
