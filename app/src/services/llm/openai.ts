import type { LLMClient, LLMRequest, LLMResponse, StreamCallbacks } from './types'
import { toProxyUrl } from '@/utils/proxy'

export interface ModelInfo {
  id: string
  owned_by?: string
  created?: number
}

export class OpenAIClient implements LLMClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl?: string, preventCache: boolean = false) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl || 'https://api.openai.com/v1'
    this.preventCache = preventCache
  }
  
  private preventCache: boolean = false

  private getUrl(path: string): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl
    return toProxyUrl(`${base}${path}`)
  }

  // 获取可用模型列表
  async listModels(): Promise<ModelInfo[]> {
    const url = this.getUrl('/models')
    console.log('[OpenAIClient] listModels BaseURL:', this.baseUrl)
    console.log('[OpenAIClient] listModels Request URL:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API Error: ${response.status}`)
    }

    const data = await response.json()
    // 过滤出 chat 模型（通常包含 gpt、chat 等关键词）
    const models: ModelInfo[] = data.data || []
    return models
      .filter((m: ModelInfo) =>
        m.id.includes('gpt') ||
        m.id.includes('chat') ||
        m.id.includes('claude') ||
        m.id.includes('llama') ||
        m.id.includes('qwen') ||
        m.id.includes('deepseek') ||
        m.id.includes('mistral') ||
        m.id.includes('gemma')
      )
      .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id))
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const url = this.getUrl('/chat/completions')
    console.log('[OpenAIClient] chat BaseURL:', this.baseUrl)
    console.log('[OpenAIClient] chat Request URL:', url)

    // Handle Cache Prevention
    let messages: any[] = request.messages.map(m => {
      if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            ...m.attachments.map(att => ({
              type: 'image_url',
              image_url: {
                url: att.content
              }
            }))
          ]
        }
      }
      return {
        role: m.role,
        content: m.content
      }
    })

    if (this.preventCache) {
       // Inject random system message at the end of system block or beginning of conversation
       const nonce = Math.random().toString(36).substring(7)
       messages = [
         { role: 'system', content: `[System Note: Ignore this random identifier used to bypass cache: ${nonce}]` },
         ...messages
       ]
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: messages,
        temperature: request.params.temperature,
        max_tokens: request.params.maxTokens,
        top_p: request.params.topP,
        frequency_penalty: request.params.frequencyPenalty,
        presence_penalty: request.params.presencePenalty,
        // Some providers support seed
        seed: this.preventCache ? Math.floor(Math.random() * 10000) : undefined
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API Error: ${response.status}`)
    }

    const data = await response.json()
    return {
      content: data.choices[0]?.message?.content || '',
      tokenUsage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    }
  }

  async chatStream(request: LLMRequest, callbacks: StreamCallbacks): Promise<void> {
    try {
      // Handle Cache Prevention
      let messages = request.messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      if (this.preventCache) {
         const nonce = Math.random().toString(36).substring(7)
         messages = [
           { role: 'system', content: `[System Note: Ignore this random identifier used to bypass cache: ${nonce}]` },
           ...messages
         ]
      }

      const response = await fetch(this.getUrl('/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: request.model,
          messages: messages,
          temperature: request.params.temperature,
          max_tokens: request.params.maxTokens,
          top_p: request.params.topP,
          frequency_penalty: request.params.frequencyPenalty,
          presence_penalty: request.params.presencePenalty,
          stream: true,
          stream_options: { include_usage: true },
          seed: this.preventCache ? Math.floor(Math.random() * 10000) : undefined
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
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              const content = delta?.content
              const reasoning = delta?.reasoning_content

              if (reasoning) {
                // If there's reasoning content (e.g. DeepSeek R1), treat it specially
                // For now, we prepend it as a "Thinking..." block or just emit it
                // We'll emit it wrapped in a custom tag if needed, or just let UI handle it.
                // Let's emit it wrapped in <think> tags if it's not already.
                // Or better, just emit it and let the UI decide how to render.
                // But the onToken interface is string.
                // Let's modify onToken to accept reasoning? No, that breaks interface.
                // Let's wrap it in <think> tags for the stream.
                // Actually, DeepSeek R1 output usually contains <think> tags in the content itself if using some endpoints,
                // but the API spec says `reasoning_content`.
                // If we get reasoning_content, let's wrap it.
                // const reasoningChunk = `<think>${reasoning}</think>`
                // Wait, if we wrap every chunk, it will be <think>c</think><think>h</think>... bad.
                // We should just emit it. The UI might need to know it's reasoning.
                // For simplicity in this Playground, let's append it to content but maybe formatted?
                // Or just standard output.
                // If the user wants to see it, we should probably output it.
                // Let's just output it as part of the content for now.
                // Note: DeepSeek API `reasoning_content` is separate.
                // If we just append it, it mixes with answer.
                // Let's wrap the *entire* reasoning block in <think>...</think> in the final output, 
                // but for streaming, we can't easily do that without state.
                // Strategy: Emit reasoning as is, but maybe prepend a marker?
                // Actually, most R1 implementations put reasoning *before* content.
                // Let's just emit it.
                callbacks.onToken(reasoning)
                fullContent += reasoning
              }

              if (content) {
                fullContent += content
                callbacks.onToken(content)
              }
              // 获取 usage 信息
              if (parsed.usage) {
                tokenUsage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      callbacks.onComplete({
        content: fullContent,
        tokenUsage
      })
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }
}
