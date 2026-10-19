/** Client-side upload rules, mirroring the server so users learn about problems before uploading. */
const MB = 1024 * 1024
export const MAX_ATTACHMENT = 4 * MB
export const MAX_PER_CARD = 10
export const MAX_BACKGROUND_UPLOAD = 10 * MB
export const BACKGROUND_EDGE = 2560
export const PRESETS = ['navy', 'dusk', 'sky', 'meadow', 'sunrise', 'graphite']

const ATTACHMENT_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'csv', 'docx', 'xlsx', 'pptx']
const BACKGROUND_TYPES = ['jpg', 'jpeg', 'png', 'webp']
export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.map((t) => `.${t}`).join(',')
export const BACKGROUND_ACCEPT = 'image/jpeg,image/png,image/webp'

const extension = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '')

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}

/** Why this file cannot be attached, or null when it is fine. */
export function attachmentError(file: File): string | null {
  if (!ATTACHMENT_TYPES.includes(extension(file.name)))
    return 'This file type isn\'t allowed. Use images, PDF, text, CSV or Office files.'
  if (file.size > MAX_ATTACHMENT) return `This file is ${formatSize(file.size)}. The limit is 4 MB.`
  return null
}

export function backgroundError(file: File): string | null {
  if (!BACKGROUND_TYPES.includes(extension(file.name))) return 'Choose a JPG, PNG or WebP photo.'
  if (file.size > MAX_BACKGROUND_UPLOAD) return `This photo is ${formatSize(file.size)}. The limit is 10 MB.`
  return null
}

/** Size that fits within `edge` on the longest side, never enlarging. */
export function fitWithin(width: number, height: number, edge = BACKGROUND_EDGE) {
  const scale = Math.min(1, edge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Shrink a photo in the browser and encode it as WebP before upload. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("This photo couldn't be read."))),
      'image/webp',
      0.85,
    ),
  )
}
