import { useEffect, useRef, useState } from 'react'

// Every photo leaves the browser as a JPEG no larger than 1600px: smaller uploads, one format
// for the server, and EXIF (location, device) is dropped when the image is redrawn.
function toJpeg(source, width, height, max = 1600) {
  const scale = Math.min(1, max / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

export async function fileToJpeg(file) {
  const bitmap = await createImageBitmap(file) // applies the photo's own rotation
  try {
    return await toJpeg(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

export function useCamera(facingMode) {
  const video = useRef(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream])
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream
  }, [stream])

  const start = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera. Use the upload option, or try Chrome or Safari.')
      return
    }
    try {
      setStream(await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      }))
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? 'Camera access is blocked. Allow it in your browser settings, then try again.'
        : 'We could not start your camera. Close other apps that are using it and try again.')
    }
  }

  const capture = () => {
    const v = video.current
    return toJpeg(v, v.videoWidth, v.videoHeight)
  }

  return { video, stream, error, start, stop: () => setStream(null), capture }
}
