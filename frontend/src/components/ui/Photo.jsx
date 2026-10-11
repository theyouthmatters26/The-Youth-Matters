import photos from '../../data/photos.json'

// Shown for a country whose photograph has not been made yet (frontend/scripts/photos.py)
const STAND_IN = '/images/chatroom.jpg'

// The site's own photographs are kept at several widths as AVIF (made by frontend/scripts/photos.py),
// so a phone downloads a phone-sized picture. The original JPEG stays as the fallback for old browsers.
// Anything else (a member's upload, a new blog cover) is shown as it is.

// A country's picture: the one the team uploaded in the admin panel, or the photograph that shipped
// with the website for the countries it started with. A country added since the last photo run has
// neither, and the page it sits on is built ahead of time, so the onError stand-in below would not
// be listening yet: name the stand-in here instead of a file we know is not there.
export const cityPhoto = (country) => {
  if (country?.image) return country.image
  const shipped = `/images/city-${country?.slug}.jpg`
  return photos[shipped] ? shipped : STAND_IN
}

// True when a picture has actually been made (frontend/scripts/photos.py). Lets a page leave a
// space out rather than point at a file that is not there: these pages are built ahead of time, so
// the onError stand-in below is not listening yet.
export const shipped = (src) => Boolean(photos[src])

export const copies = (src, widths, tall = '') =>
  widths.map((w) => `${src.replace(/\.(jpg|png)$/, '')}-${tall}${w}.avif ${w}w`).join(', ')

// sizes: how wide the picture is on screen, in CSS terms ("100vw", "(max-width: 720px) 92vw, 400px").
// priority: the main picture at the top of a page. It is fetched first; everything else waits until it is near the screen.
// A site picture that has not been made yet (a country added after the last photo run) falls back
// to a neutral one, so a new community never shows a broken image.
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
