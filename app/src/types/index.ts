// 消息角色类型
export type MessageRole = 'system' | 'user' | 'assistant'

export interface MessageAttachment {
  id: string
  type: 'image'
  content: string // base64
  name?: string
  mimeType?: string
}

// 单条消息
export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  attachments?: MessageAttachment[]
}

// LLM 提供商
export type LLMProvider = 'openai' | 'anthropic' | 'custom'

// 模型配置
export interface ModelConfig {
  provider: LLMProvider
  model: string
  apiKey: string
  baseUrl?: string
}

// 模型参数
export interface ModelParams {
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

// 变量定义
export interface Variable {
  name: string
  value: string
}

// 提示词会话
export interface PromptSession {
  id: string
  name: string
  systemPrompt: string
  messages: ChatMessage[]
  variables: Variable[]
  modelConfig: ModelConfig
  params: ModelParams
  createdAt: number
  updatedAt: number
}

// 运行结果
export interface RunResult {
  id: string
  sessionId: string
  input: ChatMessage[]
  output: string
  model: string
  tokenUsage: TokenUsage
  duration: number
  timestamp: number
}

// Token 使用统计
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// 测试用例
export interface TestCase {
  id: string
  name: string
  variables: Variable[]
  expectedOutput?: string
  tags: string[]
}

// 评估结果
export interface EvaluationResult {
  testCaseId: string
  runResultId: string
  score?: number
  passed?: boolean
  notes?: string
}

// 提示词版本
export interface PromptVersion {
  id: string
  sessionId: string
  name: string
  systemPrompt: string
  messages: ChatMessage[]
  createdAt: number
}

// API Key 存储
export interface APIKeyConfig {
  provider: LLMProvider
  apiKey: string
  baseUrl?: string
}

// 可用模型列表
export const AVAILABLE_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  custom: []
}

// 默认参数
export const DEFAULT_PARAMS: ModelParams = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0
}
