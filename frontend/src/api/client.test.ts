import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, ApiError } from './client'

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('api client (T-200, T-201)', () => {
  test('GET sends same-origin credentials and returns JSON', async () => {
    const fetchMock = mockFetch(200, { id: 1 })
    expect(await api('/auth/me')).toEqual({ id: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('same-origin')
    expect(init.body).toBeUndefined()
  })

  test('a body is sent as JSON with POST by default', async () => {
    const fetchMock = mockFetch(201, { ok: true })
    await api('/boards', { body: { title: 'Q4' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ title: 'Q4' })
  })

  test('204 returns undefined', async () => {
    mockFetch(204)
    expect(await api('/auth/signout', { method: 'POST' })).toBeUndefined()
  })

  test('error detail string becomes the message', async () => {
    mockFetch(409, { detail: 'Email already registered' })
    await expect(api('/auth/signup', { body: {} })).rejects.toEqual(
      new ApiError(409, 'Email already registered'),
    )
  })

  test('validation errors become a readable sentence', async () => {
    mockFetch(422, {
      detail: [{ loc: ['body', 'password'], msg: 'String should have at least 8 characters' }],
    })
    await expect(api('/auth/signup', { body: {} })).rejects.toThrow(
      'Password: String should have at least 8 characters',
    )
  })

  test('429 without detail gets a specific message', async () => {
    mockFetch(429)
    await expect(api('/auth/signin', { body: {} })).rejects.toThrow(/too many requests/i)
  })

  test('429 with a server message keeps it', async () => {
    mockFetch(429, { detail: "Today's free AI limit is reached." })
    await expect(api('/ai/chat', { body: {} })).rejects.toThrow("Today's free AI limit is reached.")
  })

  test('network failure gives a clear message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api('/boards')).rejects.toThrow(/can't reach the server/i)
  })

  test('ApiError keeps the status', async () => {
    mockFetch(401, { detail: 'Not signed in' })
    const error = (await api('/auth/me').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
  })
})
