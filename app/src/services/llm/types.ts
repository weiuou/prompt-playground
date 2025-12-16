import type { ChatMessage, TokenUsage, ModelParams } from '@/types'

// LLM 请求参数
export interface LLMRequest {
  messages: ChatMessage[]
  model: string
  params: ModelParams
}

// LLM 响应
export interface LLMResponse {
  content: string
  tokenUsage: TokenUsage
}

// 流式回调
export interface StreamCallbacks {
  onToken: (token: string) => void
  onComplete: (response: LLMResponse) => void
  onError: (error: Error) => void
}

// LLM 客户端接口
export interface LLMClient {
  chat(request: LLMRequest): Promise<LLMResponse>
  chatStream(request: LLMRequest, callbacks: StreamCallbacks): Promise<void>
}
