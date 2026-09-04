/**
 * HTTP 请求封装（Web 版）。
 * 与桌面版（client-app，基于 Tauri 插件）保持相同的函数签名，
 * 内部直接使用浏览器原生 fetch（自动跟随重定向，依赖服务端 CORS 配置）。
 */

export async function httpFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}

/**
 * 带重定向处理的请求。
 * Web 版直接交由浏览器自动处理重定向，保留此函数仅为与桌面版接口一致。
 */
export async function httpFetchWithRedirect(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}

/**
 * Upload files using multipart/form-data constructed as Uint8Array.
 */
export async function uploadWithFiles(
  url: string,
  fields: Record<string, string>,
  files: File[],
  headers?: Record<string, string>,
): Promise<Response> {
  const boundary = '----WebFormBoundary' + Math.random().toString(36).slice(2)
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []

  for (const [key, value] of Object.entries(fields)) {
    parts.push(encoder.encode(`--${boundary}\r\n`))
    parts.push(encoder.encode(`Content-Disposition: form-data; name="${key}"\r\n\r\n`))
    parts.push(encoder.encode(`${value}\r\n`))
  }

  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const safeName = file.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '')
    parts.push(encoder.encode(`--${boundary}\r\n`))
    parts.push(encoder.encode(`Content-Disposition: form-data; name="files"; filename="${safeName}"\r\n`))
    parts.push(encoder.encode(`Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`))
    parts.push(new Uint8Array(buffer))
    parts.push(encoder.encode(`\r\n`))
  }

  parts.push(encoder.encode(`--${boundary}--\r\n`))

  let totalLength = 0
  for (const p of parts) totalLength += p.length
  const body = new Uint8Array(totalLength)
  let offset = 0
  for (const p of parts) {
    body.set(p, offset)
    offset += p.length
  }

  return httpFetchWithRedirect(url, {
    method: 'POST',
    headers: {
      ...(headers || {}),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })
}

/**
 * 解析服务端返回的结构化错误 JSON，提取可读 message。
 * 如果 JSON 解析失败，回退到 res.statusText。
 */
export async function parseServerError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string; message?: string }
    if (body.message) return body.message
    if (body.error) return body.error
  } catch {
    // JSON 解析失败，回退到 statusText
  }
  return res.statusText || `HTTP ${res.status}`
}
