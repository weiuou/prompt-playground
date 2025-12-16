// 检测是否在开发环境中
const isDev = import.meta.env.DEV

// 将 URL 转换为代理 URL（仅在开发环境）
// https://api.example.com/v1/models -> /proxy/https/api.example.com/v1/models
export function toProxyUrl(url: string): string {
  if (!isDev) {
    return url
  }

  try {
    const urlObj = new URL(url)
    if (urlObj.protocol === 'https:') {
      return `/proxy/https/${urlObj.host}${urlObj.pathname}${urlObj.search}`
    }
  } catch {
    // 如果不是完整 URL，直接返回
  }

  return url
}

// 获取用于 fetch 的 URL（自动处理代理）
export function getFetchUrl(baseUrl: string, path: string): string {
  const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`
  return toProxyUrl(fullUrl)
}
