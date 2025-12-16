<script setup lang="ts">
import { ref } from 'vue'
import { usePromptStore } from '@/stores/prompt'
import { useSettingsStore } from '@/stores/settings'
import { PromptOptimizer } from '@/services/optimizer'
import { createLLMClient } from '@/services/llm'
import { NCard, NInput, NButton, NIcon, useMessage, NTooltip } from 'naive-ui'
import { SparklesOutline } from '@vicons/ionicons5'

const promptStore = usePromptStore()
const settingsStore = useSettingsStore()
const message = useMessage()
const isRefining = ref(false)

async function handleRefine() {
  const draft = promptStore.systemPrompt.trim()
  if (!draft) {
    message.warning('请先输入提示词以便润色。')
    return
  }
  
  if (!settingsStore.currentApiKey) {
    message.warning('请先设置 API Key。')
    return
  }

  isRefining.value = true
  try {
    const client = createLLMClient(
      settingsStore.currentProvider,
      settingsStore.currentApiKey,
      settingsStore.currentBaseUrl
    )
    
    // We use default config for refinement
    const optimizer = new PromptOptimizer(client, {
      maxSteps: 0,
      modelId: settingsStore.currentModel,
      evalModelId: settingsStore.currentModel,
      initialTemplate: '',
      optimizationTemplate: ''
    })

    const refined = await optimizer.refinePrompt(draft)
    promptStore.setSystemPrompt(refined)
    message.success('提示词润色成功！')
  } catch (error) {
    message.error(`润色失败: ${error}`)
  } finally {
    isRefining.value = false
  }
}
</script>

<template>
  <n-card size="small">
    <template #header>
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>系统提示词 (System Prompt)</span>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button 
              size="tiny" 
              secondary 
              type="primary" 
              @click="handleRefine" 
              :loading="isRefining"
            >
              <template #icon>
                <n-icon><SparklesOutline /></n-icon>
              </template>
              润色
            </n-button>
          </template>
          使用 AI 一键优化提示词
        </n-tooltip>
      </div>
    </template>
    <n-input
      v-model:value="promptStore.systemPrompt"
      type="textarea"
      placeholder="输入系统提示词..."
      :autosize="{ minRows: 3, maxRows: 8 }"
    />
  </n-card>
</template>
