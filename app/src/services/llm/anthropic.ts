import type { LLMClient, LLMRequest, LLMResponse, StreamCallbacks } from './types'
import { toProxyUrl } from '@/utils/proxy'

export class AnthropicClient implements LLMClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl || 'https://api.anthropic.com'
  }

  private getUrl(path: string): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl
    return toProxyUrl(`${base}${path}`)
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // 分离 system 消息
    const systemMessage = request.messages.find(m => m.role === 'system')
    const otherMessages = request.messages.filter(m => m.role !== 'system')

    const response = await fetch(this.getUrl('/v1/messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.params.maxTokens,
        temperature: request.params.temperature,
        top_p: request.params.topP,
        system: systemMessage?.content || undefined,
        messages: otherMessages.map(m => {
          if (m.attachments && m.attachments.length > 0) {
            const contentParts: any[] = []
            m.attachments.forEach(att => {
              if (att.type === 'image') {
                const matches = att.content.match(/^data:(.+);base64,(.+)$/)
                if (matches) {
                  contentParts.push({
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: matches[1],
                      data: matches[2]
                    }
                  })
                }
              }
            })
            if (m.content) {
              contentParts.push({ type: 'text', text: m.content })
            }
            return {
              role: m.role,
              content: contentParts
            }
          }
          return {
            role: m.role,
            content: m.content
          }
        })
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API Error: ${response.status}`)
    }

    const data = await response.json()
    return {
      content: data.content?.[0]?.text || '',
      tokenUsage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    }
  }

  async chatStream(request: LLMRequest, callbacks: StreamCallbacks): Promise<void> {
    try {
      // 分离 system 消息
      const systemMessage = request.messages.find(m => m.role === 'system')
      const otherMessages = request.messages.filter(m => m.role !== 'system')

      const response = await fetch(this.getUrl('/v1/messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.params.maxTokens,
          temperature: request.params.temperature,
          top_p: request.params.topP,
          system: systemMessage?.content || undefined,
          messages: otherMessages.map(m => {
            if (m.attachments && m.attachments.length > 0) {
              const contentParts: any[] = []
              m.attachments.forEach(att => {
                if (att.type === 'image') {
                  const matches = att.content.match(/^data:(.+);base64,(.+)$/)
                  if (matches) {
                    contentParts.push({
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: matches[1],
                        data: matches[2]
                      }
                    })
                  }
                }
              })
              if (m.content) {
                contentParts.push({ type: 'text', text: m.content })
              }
              return {
                role: m.role,
                content: contentParts
              }
            }
            return {
              role: m.role,
              content: m.content
            }
          }),
          stream: true
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `API Error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text
                if (text) {
                  fullContent += text
                  callbacks.onToken(text)
                }
              }

              if (parsed.type === 'message_delta' && parsed.usage) {
                tokenUsage.completionTokens = parsed.usage.output_tokens || 0
              }

              if (parsed.type === 'message_start' && parsed.message?.usage) {
                tokenUsage.promptTokens = parsed.message.usage.input_tokens || 0
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      tokenUsage.totalTokens = tokenUsage.promptTokens + tokenUsage.completionTokens

      callbacks.onComplete({
        content: fullContent,
        tokenUsage
      })
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }
}
