<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NSpace,
  NCard,
  NInput,
  NIcon,
  NTabs,
  NTabPane
} from 'naive-ui'
import { ArrowBackOutline, SaveOutline, DownloadOutline, CloudUploadOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { exportAllData, importData } from '@/services/storage'

const router = useRouter()
const message = useMessage()
const settingsStore = useSettingsStore()

// API Key 临时值
const openaiKey = ref('')
const openaiBaseUrl = ref('')
const anthropicKey = ref('')
const anthropicBaseUrl = ref('')
const customKey = ref('')
const customBaseUrl = ref('')

// 加载现有配置
function loadExistingConfig() {
  const openai = settingsStore.apiKeys.find(k => k.provider === 'openai')
  const anthropic = settingsStore.apiKeys.find(k => k.provider === 'anthropic')
  const custom = settingsStore.apiKeys.find(k => k.provider === 'custom')

  if (openai) {
    openaiKey.value = openai.apiKey
    openaiBaseUrl.value = openai.baseUrl || ''
  }
  if (anthropic) {
    anthropicKey.value = anthropic.apiKey
    anthropicBaseUrl.value = anthropic.baseUrl || ''
  }
  if (custom) {
    customKey.value = custom.apiKey
    customBaseUrl.value = custom.baseUrl || ''
  }
}

loadExistingConfig()

// 保存设置
function saveSettings() {
  if (openaiKey.value) {
    settingsStore.setApiKey('openai', openaiKey.value, openaiBaseUrl.value || undefined)
  }
  if (anthropicKey.value) {
    settingsStore.setApiKey('anthropic', anthropicKey.value, anthropicBaseUrl.value || undefined)
  }
  if (customKey.value && customBaseUrl.value) {
    settingsStore.setApiKey('custom', customKey.value, customBaseUrl.value)
  }
  message.success('设置已保存')
}

// 导出数据
async function handleExport() {
  try {
    const data = await exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prompt-playground-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('数据已导出')
  } catch (error) {
    message.error('导出失败')
  }
}

// 导入数据
async function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importData(data)
      message.success('数据已导入')
    } catch (error) {
      message.error('导入失败，请检查文件格式')
    }
  }
  input.click()
}
</script>

<template>
  <n-layout class="layout">
    <n-layout-header bordered class="header">
      <div class="header-left">
        <n-button quaternary @click="router.push('/')">
          <template #icon>
            <n-icon><ArrowBackOutline /></n-icon>
          </template>
        </n-button>
        <h2>设置</h2>
      </div>
      <div class="header-right">
        <n-button type="primary" @click="saveSettings">
          <template #icon>
            <n-icon><SaveOutline /></n-icon>
          </template>
          保存
        </n-button>
      </div>
    </n-layout-header>

    <n-layout-content class="content">
      <n-tabs type="line">
        <n-tab-pane name="api" tab="API 配置">
          <n-space vertical size="large">
            <n-card title="OpenAI">
              <n-space vertical>
                <n-input
                  v-model:value="openaiKey"
                  type="password"
                  show-password-on="click"
                  placeholder="sk-..."
                />
                <n-input
                  v-model:value="openaiBaseUrl"
                  placeholder="Base URL (可选，默认 https://api.openai.com/v1)"
                />
              </n-space>
            </n-card>

            <n-card title="Anthropic">
              <n-space vertical>
                <n-input
                  v-model:value="anthropicKey"
                  type="password"
                  show-password-on="click"
                  placeholder="sk-ant-..."
                />
                <n-input
                  v-model:value="anthropicBaseUrl"
                  placeholder="Base URL (可选)"
                />
              </n-space>
            </n-card>

            <n-card title="自定义 (OpenAI 兼容)">
              <n-space vertical>
                <n-input
                  v-model:value="customKey"
                  type="password"
                  show-password-on="click"
                  placeholder="API Key"
                />
                <n-input
                  v-model:value="customBaseUrl"
                  placeholder="Base URL (必填)"
                />
              </n-space>
            </n-card>
          </n-space>
        </n-tab-pane>

        <n-tab-pane name="data" tab="数据管理">
          <n-card title="导入导出">
            <n-space>
              <n-button @click="handleExport">
                <template #icon>
                  <n-icon><DownloadOutline /></n-icon>
                </template>
                导出数据
              </n-button>
              <n-button @click="handleImport">
                <template #icon>
                  <n-icon><CloudUploadOutline /></n-icon>
                </template>
                导入数据
              </n-button>
            </n-space>
          </n-card>
        </n-tab-pane>
      </n-tabs>
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.layout {
  height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
}

.content {
  padding: 16px;
  max-width: 800px;
}
</style>
