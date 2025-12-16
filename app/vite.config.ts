import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/prompt-playground/' : '/',
  plugins: [
    vue(),
    {
      name: 'custom-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/proxy/https/')) {
            try {
              const match = req.url.match(/^\/proxy\/https\/([^/]+)(\/.*)$/)
              if (!match) {
                res.statusCode = 400
                res.end('Invalid proxy URL')
                return
              }

              const [, host, path] = match
              const targetUrl = `https://${host}${path}`
              console.log(`[CustomProxy] ${req.method} ${req.url} -> ${targetUrl}`)

              const headers = new Headers()
              // 复制原始请求头，但排除 host 和 connection 等
              for (const [key, value] of Object.entries(req.headers)) {
                if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
                  headers.set(key, value as string)
                }
              }

              // 设置伪装头
              headers.set('Host', host)
              headers.set('Origin', `https://${host}`)
              headers.set('Referer', `https://${host}/`)
              headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
              
              // 移除指纹头
              const headersToRemove = [
                'cookie', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 
                'sec-fetch-user', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
                'dnt', 'pragma', 'cache-control'
              ]
              headersToRemove.forEach(h => headers.delete(h))

              const fetchOptions: RequestInit = {
                method: req.method,
                headers,
                redirect: 'follow'
              }

              // 处理 body
              if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
                const chunks = []
                for await (const chunk of req) {
                  chunks.push(chunk)
                }
                fetchOptions.body = Buffer.concat(chunks)
              }

              const response = await fetch(targetUrl, fetchOptions)

              // 设置响应头
              res.statusCode = response.status
              response.headers.forEach((value, key) => {
                 // 排除一些可能导致问题的响应头
                 if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                   res.setHeader(key, value)
                 }
              })

              // 流式传输响应体
              if (response.body) {
                const reader = response.body.getReader()
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  res.write(value)
                }
              }
              res.end()

            } catch (error) {
              console.error('[CustomProxy] Error:', error)
              res.statusCode = 500
              res.end(`Proxy Error: ${error}`)
            }
          } else {
            next()
          }
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    // 自定义中间件处理代理，绕过 vite 默认代理的指纹问题
  }
})
