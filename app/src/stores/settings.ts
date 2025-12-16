import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { APIKeyConfig, LLMProvider, ModelParams } from '@/types'
import { DEFAULT_PARAMS, AVAILABLE_MODELS } from '@/types'
import { OpenAIClient } from '@/services/llm/openai'

export const useSettingsStore = defineStore('settings', () => {
  // API Keys 配置
  const apiKeys = ref<APIKeyConfig[]>([])

  // 当前选择的提供商和模型
  const currentProvider = ref<LLMProvider>('openai')
  const currentModel = ref<string>('gpt-4o-mini')

  // 模型参数
  const params = ref<ModelParams>({ ...DEFAULT_PARAMS })
  
  // 防缓存设置
  const preventCache = ref(false)

  // 动态获取的模型列表（按提供商存储）
  const fetchedModels = ref<Record<string, string[]>>({})

  // 是否正在加载模型列表
  const isLoadingModels = ref(false)

  // 获取当前提供商的 API Key
  const currentApiKey = computed(() => {
    const config = apiKeys.value.find(k => k.provider === currentProvider.value)
    return config?.apiKey || ''
  })

  // 获取当前提供商的 Base URL
  const currentBaseUrl = computed(() => {
    const config = apiKeys.value.find(k => k.provider === currentProvider.value)
    return config?.baseUrl
  })

  // 生成当前配置的唯一 key（provider + baseUrl）
  function getConfigKey(provider: LLMProvider, baseUrl?: string): string {
    return `${provider}:${baseUrl || 'default'}`
  }

  // 获取当前提供商可用的模型列表（优先使用动态获取的）
  const availableModels = computed(() => {
    const key = getConfigKey(currentProvider.value, currentBaseUrl.value)
    const fetched = fetchedModels.value[key]
    if (fetched && fetched.length > 0) {
      return fetched
    }
    return AVAILABLE_MODELS[currentProvider.value] || []
  })

  // 设置 API Key
  function setApiKey(provider: LLMProvider, apiKey: string, baseUrl?: string) {
    const index = apiKeys.value.findIndex(k => k.provider === provider)
    if (index >= 0) {
      apiKeys.value[index] = { provider, apiKey, baseUrl }
    } else {
      apiKeys.value.push({ provider, apiKey, baseUrl })
    }
    saveToStorage()
  }

  // 切换提供商
  function setProvider(provider: LLMProvider) {
    currentProvider.value = provider
    // 自动选择该提供商的第一个模型
    const models = AVAILABLE_MODELS[provider]
    if (models && models.length > 0) {
      currentModel.value = models[0] || ''
    }
    saveToStorage()
  }

  // 设置模型
  function setModel(model: string) {
    currentModel.value = model
    saveToStorage()
  }

  // 更新参数
  function updateParams(newParams: Partial<ModelParams>) {
    params.value = { ...params.value, ...newParams }
    saveToStorage()
  }

  // 重置参数
  function resetParams() {
    params.value = { ...DEFAULT_PARAMS }
    saveToStorage()
  }

  // 从 API 获取模型列表
  async function fetchModels(): Promise<string[]> {
    const apiKey = currentApiKey.value
    if (!apiKey) {
      throw new Error('请先设置 API Key')
    }

    isLoadingModels.value = true
    try {
      // 目前只有 OpenAI 兼容的 API 支持 /models 接口
      // Anthropic 没有这个接口
      if (currentProvider.value === 'anthropic') {
        return AVAILABLE_MODELS.anthropic
      }

      const client = new OpenAIClient(apiKey, currentBaseUrl.value)
      const models = await client.listModels()
      const modelIds = models.map(m => m.id)

      // 缓存结果
      const key = getConfigKey(currentProvider.value, currentBaseUrl.value)
      fetchedModels.value[key] = modelIds
      saveToStorage()

      // 如果当前选择的模型不在列表中，自动选择第一个
      if (modelIds.length > 0 && !modelIds.includes(currentModel.value)) {
        currentModel.value = modelIds[0] || ''
      }

      return modelIds
    } finally {
      isLoadingModels.value = false
    }
  }

  // 清除缓存的模型列表
  function clearFetchedModels() {
    const key = getConfigKey(currentProvider.value, currentBaseUrl.value)
    delete fetchedModels.value[key]
    saveToStorage()
  }

  // 保存到 localStorage
  function saveToStorage() {
    const data = {
      apiKeys: apiKeys.value,
      currentProvider: currentProvider.value,
      currentModel: currentModel.value,
      params: params.value,
      fetchedModels: fetchedModels.value,
      preventCache: preventCache.value
    }
    localStorage.setItem('prompt-playground-settings', JSON.stringify(data))
  }

  // 从 localStorage 加载
  function loadFromStorage() {
    const saved = localStorage.getItem('prompt-playground-settings')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.apiKeys) apiKeys.value = data.apiKeys
        if (data.currentProvider) currentProvider.value = data.currentProvider
        if (data.currentModel) currentModel.value = data.currentModel
        if (data.params) params.value = { ...DEFAULT_PARAMS, ...data.params }
        if (data.fetchedModels) fetchedModels.value = data.fetchedModels
        if (data.preventCache !== undefined) preventCache.value = data.preventCache
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
  }

  // 初始化时加载
  loadFromStorage()

  return {
    apiKeys,
    currentProvider,
    currentModel,
    params,
    preventCache,
    currentApiKey,
    currentBaseUrl,
    availableModels,
    isLoadingModels,
    fetchedModels,
    setApiKey,
    setProvider,
    setModel,
    updateParams,
    resetParams,
    fetchModels,
    clearFetchedModels
  }
})
