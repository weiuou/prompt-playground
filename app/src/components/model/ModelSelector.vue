<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import {
  NSpace,
  NSelect,
  NButton,
  NIcon,
  useMessage
} from 'naive-ui'
import {
  RefreshOutline,
  SettingsOutline
} from '@vicons/ionicons5'
import ApiKeyModal from './ApiKeyModal.vue'

const message = useMessage()
const settingsStore = useSettingsStore()

const showApiKeyModal = ref(false)

// 提供商选项
const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Custom', value: 'custom' }
]

// 模型选项
const modelOptions = computed(() => {
  return settingsStore.availableModels.map(m => ({ label: m, value: m }))
})

// 获取模型列表
async function handleFetchModels() {
  if (!settingsStore.currentApiKey) {
    message.warning('请先设置 API Key')
    showApiKeyModal.value = true
    return
  }

  try {
    const models = await settingsStore.fetchModels()
    message.success(`获取到 ${models.length} 个模型`)
  } catch (error) {
    message.error(`获取模型列表失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
</script>

<template>
  <div class="model-selector">
    <n-space>
      <n-select
        v-model:value="settingsStore.currentProvider"
        :options="providerOptions"
        style="width: 120px"
        @update:value="settingsStore.setProvider"
      />
      <n-select
        v-model:value="settingsStore.currentModel"
        :options="modelOptions"
        style="width: 200px"
        filterable
        tag
        @update:value="settingsStore.setModel"
      />
      <n-button
        :loading="settingsStore.isLoadingModels"
        @click="handleFetchModels"
        title="从 API 获取模型列表"
      >
        <template #icon>
          <n-icon><RefreshOutline /></n-icon>
        </template>
      </n-button>
      <n-button @click="showApiKeyModal = true">
        <template #icon>
          <n-icon><SettingsOutline /></n-icon>
        </template>
        API Key
      </n-button>
    </n-space>

    <ApiKeyModal v-model:show="showApiKeyModal" />
  </div>
</template>
