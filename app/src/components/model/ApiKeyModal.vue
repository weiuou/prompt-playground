<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import {
  NCard,
  NSpace,
  NInput,
  NButton,
  useMessage
} from 'naive-ui'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const message = useMessage()
const settingsStore = useSettingsStore()

const tempApiKey = ref('')
const tempBaseUrl = ref('')

// Watch for show change to init values
watch(() => props.show, (newVal) => {
  if (newVal) {
    const config = settingsStore.apiKeys.find(k => k.provider === settingsStore.currentProvider)
    tempApiKey.value = config?.apiKey || ''
    tempBaseUrl.value = config?.baseUrl || ''
  }
})

function handleClose() {
  emit('update:show', false)
}

function saveApiKey() {
  if (tempApiKey.value.trim()) {
    settingsStore.setApiKey(
      settingsStore.currentProvider,
      tempApiKey.value.trim(),
      tempBaseUrl.value.trim() || undefined
    )
    message.success('API Key 已保存')
    handleClose()
    tempApiKey.value = ''
    tempBaseUrl.value = ''
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="handleClose">
    <n-card
      class="api-key-modal"
      title="设置 API Key"
      closable
      @close="handleClose"
    >
      <n-space vertical>
        <n-input
          v-model:value="tempApiKey"
          type="password"
          show-password-on="click"
          placeholder="输入 API Key"
        />
        <n-input
          v-model:value="tempBaseUrl"
          placeholder="Base URL (可选)"
        />
        <n-button type="primary" block @click="saveApiKey">
          保存
        </n-button>
      </n-space>
    </n-card>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.api-key-modal {
  width: 400px;
}
</style>
