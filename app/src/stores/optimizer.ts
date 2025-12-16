import { defineStore } from 'pinia'
import { ref } from 'vue'
import { PromptOptimizer } from '@/services/optimizer'
import { META_PROMPTS } from '@/services/optimizer/templates'
import type { OptimizerConfig, OptimizationLog, OptimizationState, Example } from '@/services/optimizer/types'
import { createLLMClient } from '@/services/llm/factory'
import { useSettingsStore } from './settings'

export const useOptimizerStore = defineStore('optimizer', () => {
  const settingsStore = useSettingsStore()

  // Config
  const config = ref<OptimizerConfig>({
    maxSteps: 5,
    modelId: settingsStore.currentModel || 'gpt-4o',
    evalModelId: settingsStore.currentModel || 'gpt-4o',
    initialTemplate: META_PROMPTS.find(t => t.type === 'initial')?.content || '',
    optimizationTemplate: META_PROMPTS.find(t => t.type === 'optimization')?.content || '',
  })

  // 监听 META_PROMPTS 的变化并同步（如果用户未修改过）
  // 或者更简单地，直接在 startOptimization 时从最新的 META_PROMPTS 重新加载（如果用户没有自定义覆盖的话）
  // 目前我们假设用户可以修改，所以我们应该只在初始化时加载一次。
  // 但是，如果我们的代码更新了 META_PROMPTS（就像刚刚那样），用户的浏览器本地缓存（Pinia persist?）可能还保留着旧值。
  // 注意：这个 Store 没有 persist 插件，所以每次刷新页面应该会重置？
  // 检查 main.ts，只有 testCases store 加了 persist。
  // 那么问题可能是：Store 初始化时，META_PROMPTS 导入的是旧值？
  // 不，import 是实时的。
  // 问题是：Vue 的响应式系统。
  // 如果用户已经加载过页面，Store 已经被初始化了，HMR 可能不会重置 state。
  
  // 强制更新默认模板（如果当前值等于旧默认值，或者我们想强制应用新逻辑）
  // 为了确保 {{previous_failed_attempts}} 生效，我们需要确保 optimizationTemplate 包含它。
  // 让我们在 store 初始化时做一个简单的检查：如果 optimizationTemplate 不包含 {{previous_failed_attempts}}，则尝试更新它。
  
  const defaultOptTemplate = META_PROMPTS.find(t => t.type === 'optimization')?.content || ''
  if (config.value.optimizationTemplate && !config.value.optimizationTemplate.includes('{{previous_failed_attempts}}')) {
     // 检测到旧模板，尝试升级
     // 只有当当前模板看起来是默认模板（或者非常相似）时才覆盖，避免覆盖用户自定义的。
     // 简单起见，如果它不包含该变量，我们就追加它，或者直接重置为新的默认值。
     // 鉴于这是一个 Playground，用户可能还没自定义过，直接重置为新的默认值比较安全。
     config.value.optimizationTemplate = defaultOptTemplate
  }

  // State
  const state = ref<OptimizationState>({
    isOptimizing: false,
    currentStep: 0,
    currentPrompt: '',
    currentParams: {},
    bestPrompt: '',
    bestParams: {},
    bestScore: 0,
    logs: [],
    history: []
  })

  // Actions
  function setConfig(newConfig: Partial<OptimizerConfig>) {
    config.value = { ...config.value, ...newConfig }
  }

  function addLog(log: Omit<OptimizationLog, 'timestamp'>) {
    state.value.logs.push({
      ...log,
      timestamp: Date.now()
    })
  }

  async function startOptimization(examples: Example[]) {
    if (examples.length === 0) {
      addLog({ step: 0, type: 'error', message: 'No examples provided for optimization.' })
      return
    }

    state.value = {
      isOptimizing: true,
      currentStep: 0,
      currentPrompt: '',
      currentParams: {},
      bestPrompt: '',
      bestParams: {},
      bestScore: 0,
      logs: [],
      history: []
    }

    addLog({ step: 0, type: 'info', message: 'Starting optimization process...' })

    try {
      // Create LLM Client
      const client = createLLMClient(
        settingsStore.currentProvider,
        settingsStore.currentApiKey,
        settingsStore.currentBaseUrl
      )

      const optimizer = new PromptOptimizer(client, config.value)
      
      // Setup callbacks
      optimizer.setLogCallback((log) => addLog(log))
      optimizer.setProgressCallback((result) => {
        state.value.currentStep = result.step
        state.value.currentPrompt = result.prompt
        state.value.currentParams = result.params
        state.value.currentVariables = result.variables
        state.value.history.push({
          step: result.step,
          prompt: result.prompt,
          params: result.params,
          score: result.score
        })
      })

      // Phase 1
      const initialResult = await optimizer.generateInitialPrompt(examples)
      state.value.currentPrompt = initialResult.prompt
      state.value.currentParams = initialResult.params
      state.value.bestPrompt = initialResult.prompt
      state.value.bestParams = initialResult.params
      
      // Phase 2 (Split examples into Train/Val - for now use all for both or 80/20)
      // Simple approach: Use all for both (overfitting risk but functional for small playground)
      const result = await optimizer.optimize(initialResult.prompt, initialResult.params, examples, examples)
      
      state.value.bestPrompt = result.bestPrompt
      state.value.bestParams = result.bestParams
      state.value.bestScore = result.bestScore
      addLog({ step: config.value.maxSteps, type: 'success', message: 'Optimization completed!' })

    } catch (error) {
      addLog({ step: state.value.currentStep, type: 'error', message: `Optimization failed: ${error}` })
    } finally {
      state.value.isOptimizing = false
    }
  }

  return {
    config,
    state,
    setConfig,
    startOptimization
  }
})
