import Image from 'next/image'

const TMDB_HOST = 'https://image.tmdb.org'

interface SmartImageProps {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  sizes?: string
  priority?: boolean
}

/**
 * next/image requires every external hostname to be allowlisted in
 * next.config.mjs, which works fine for TMDb's single CDN host but can't
 * reasonably extend to Wikidata/Wikipedia thumbnails or admin-pasted poster
 * URLs (an admin could paste literally any domain). Route TMDb images
 * through next/image as usual and everything else through a plain <img> —
 * still safe, just without Next's automatic optimization for that minority
 * of non-TMDb entries.
 */
export function SmartImage({ src, alt, fill, width, height, className, sizes, priority }: SmartImageProps) {
  if (src.startsWith(TMDB_HOST)) {
    return fill ? (
      <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />
    ) : (
      <Image src={src} alt={alt} width={width} height={height} className={className} priority={priority} />
    )
  }

  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, can't be allowlisted
  return <img src={src} alt={alt} width={fill ? undefined : width} height={fill ? undefined : height} className={fill ? `absolute inset-0 h-full w-full object-cover ${className ?? ''}` : className} />
}
