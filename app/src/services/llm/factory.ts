import type { LLMProvider } from '@/types'
import type { LLMClient } from './types'
import { OpenAIClient } from './openai'
import { AnthropicClient } from './anthropic'

import { useSettingsStore } from '@/stores/settings'

export function createLLMClient(
  provider: LLMProvider,
  apiKey: string,
  baseUrl?: string
): LLMClient {
  const settingsStore = useSettingsStore()
  const preventCache = settingsStore.preventCache

  switch (provider) {
    case 'openai':
      return new OpenAIClient(apiKey, baseUrl, preventCache)
    case 'anthropic':
      // Anthropic Client doesn't support cache busting yet (add if needed)
      return new AnthropicClient(apiKey, baseUrl)
    case 'custom':
      // 自定义提供商使用 OpenAI 兼容格式
      return new OpenAIClient(apiKey, baseUrl, preventCache)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
