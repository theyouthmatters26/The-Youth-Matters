import photos from '../../data/photos.json'

// The site's own photographs are kept at several widths as AVIF (made by frontend/scripts/photos.py),
// so a phone downloads a phone-sized picture. The original JPEG stays as the fallback for old browsers.
// Anything else (a member's upload, a new blog cover) is shown as it is.

// A country's picture: the one the team uploaded in the admin panel, or the photograph that shipped
// with the website for the countries it started with.
export const cityPhoto = (country) => country?.image || `/images/city-${country?.slug}.jpg`

export const copies = (src, widths, tall = '') =>
  widths.map((w) => `${src.replace(/\.(jpg|png)$/, '')}-${tall}${w}.avif ${w}w`).join(', ')

// sizes: how wide the picture is on screen, in CSS terms ("100vw", "(max-width: 720px) 92vw, 400px").
// priority: the main picture at the top of a page. It is fetched first; everything else waits until it is near the screen.
// A site picture that has not been made yet (a country added after the last photo run) falls back
// to a neutral one, so a new community never shows a broken image.
const STAND_IN = '/images/chatroom.jpg'
const standIn = (e) => {
  if (e.target.src.endsWith(STAND_IN)) return
  e.target.srcset = ''
  e.target.src = STAND_IN
}

export default function Photo({ src, sizes = '100vw', priority = false, alt = '', children, ...img }) {
  const known = photos[src]
  const how = priority ? { fetchpriority: 'high' } : { loading: 'lazy', decoding: 'async' }
  if (!known) {
    const onError = src.startsWith('/images/') ? standIn : undefined
    return <img src={src} alt={alt} onError={onError} {...how} {...img} />
  }
  return (
    <picture>
      {children}
      <source type="image/avif" srcSet={copies(src, known.widths)} sizes={sizes} />
      <img src={src} alt={alt} width={known.w} height={known.h} {...how} {...img} />
    </picture>
  )
}
