import { currentLanguage, t } from '../i18n/language'

/** Error from the API with the HTTP status and a message fit to show the user. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal }


/** Call `/api{path}` with JSON in and out, sending the session cookie. */
export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const hasBody = options.body !== undefined
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (hasBody ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: {
        'Accept-Language': currentLanguage(),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, t('error.offline'))
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, messageFrom(response.status, data))
  return data as T
}

/** Turn an error response into a message fit for the user. */
export function messageFrom(status: number, data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const { loc, msg } = detail[0] as { loc?: string[]; msg?: string }
    const field = loc?.at(-1)
    const name = field ? field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ') : ''
    return name ? `${name}: ${msg}` : String(msg)
  }
  return t(status === 429 ? 'error.tooMany' : 'error.server')
}
