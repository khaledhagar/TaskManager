import type { Attachment, Background } from './boards'
import { api, ApiError, messageFrom } from './client'

type UploadOptions = { method?: string; onProgress?: (fraction: number) => void }

/** Multipart upload with progress (fetch cannot report upload progress). */
export function upload<T>(path: string, file: Blob, filename: string, options: UploadOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method ?? 'POST', `/api${path}`)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => e.lengthComputable && options.onProgress?.(e.loaded / e.total)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.response as T)
        : reject(new ApiError(xhr.status, messageFrom(xhr.status, xhr.response)))
    xhr.onerror = () => reject(new ApiError(0, "Can't reach the server. Check your connection and try again."))
    const form = new FormData()
    form.append('file', file, filename)
    xhr.send(form)
  })
}

export const files = {
  attach: (cardId: number, file: File, onProgress?: (fraction: number) => void) =>
    upload<Attachment>(`/cards/${cardId}/attachments`, file, file.name, { onProgress }),
  remove: (id: number) => api<void>(`/attachments/${id}`, { method: 'DELETE' }),
  url: (id: number, inline = false) => `/api/attachments/${id}${inline ? '?inline=1' : ''}`,
  usage: () => api<{ used: number; limit: number }>('/files/usage'),

  uploadBackground: (boardId: number, image: Blob, onProgress?: (fraction: number) => void) =>
    upload<Background>(`/boards/${boardId}/background`, image, 'background.webp', { method: 'PUT', onProgress }),
  setPreset: (boardId: number, preset: string) =>
    api<Background>(`/boards/${boardId}/background/preset`, { method: 'PUT', body: { preset } }),
  removeBackground: (boardId: number) => api<void>(`/boards/${boardId}/background`, { method: 'DELETE' }),
  backgroundUrl: (boardId: number, version: number) => `/api/boards/${boardId}/background?v=${version}`,
}
