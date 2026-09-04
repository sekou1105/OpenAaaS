import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { httpFetch, httpFetchWithRedirect, uploadWithFiles } from '../useHttp'

describe('httpFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use native fetch', async () => {
    const response = new Response('ok', { status: 200 })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response)

    const res = await httpFetch('http://example.com/api')
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://example.com/api', undefined)
  })

  it('should propagate fetch errors', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(httpFetch('http://example.com/api')).rejects.toThrow('Failed to fetch')
  })
})

describe('httpFetchWithRedirect', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delegate to native fetch (browser follows redirects automatically)', async () => {
    const response = new Response('ok', { status: 200 })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response)

    const res = await httpFetchWithRedirect('https://example.com/api', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    })
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({ method: 'POST' }))
  })
})

describe('uploadWithFiles', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should construct multipart body and post', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('created', { status: 201 }))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const res = await uploadWithFiles(
      'http://example.com/upload',
      { field1: 'value1' },
      [file],
      { Authorization: 'Bearer tok' },
    )

    expect(res.status).toBe(201)
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('http://example.com/upload')
    expect((call[1] as any).method).toBe('POST')
    const hdrs = (call[1] as any).headers
    expect(hdrs['Authorization']).toBe('Bearer tok')
    expect(hdrs['Content-Type']).toContain('multipart/form-data')
    expect((call[1] as any).body).toBeInstanceOf(Uint8Array)
  })
})
