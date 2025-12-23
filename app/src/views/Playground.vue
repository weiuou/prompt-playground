<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import {
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NButton,
  NSpace,
  NInput,
  NScrollbar,
  NIcon,
  NModal,
  NPopconfirm,
  NCollapseTransition
} from 'naive-ui'
import {
  PlayOutline,
  TrashOutline,
  ListOutline,
  HelpCircleOutline,
  ImageOutline,
  CloseCircleOutline
} from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { usePromptStore } from '@/stores/prompt'
import { useSettingsStore } from '@/stores/settings'
import { createLLMClient } from '@/services/llm'
import { startTour } from '@/services/tour'
import { nanoid } from '@/utils/nanoid'
import type { RunResult, MessageAttachment } from '@/types'

// Components
import VariablePanel from '@/components/editor/VariablePanel.vue'
import TokenStats from '@/components/result/TokenStats.vue'
import ModelSelector from '@/components/model/ModelSelector.vue'
import ParamsPanel from '@/components/model/ParamsPanel.vue'
import SystemPrompt from '@/components/editor/SystemPrompt.vue'
import ChatMessages from '@/components/editor/ChatMessages.vue'
import ResultPanel from '@/components/result/ResultPanel.vue'
import OptimizerPanel from '@/components/optimizer/OptimizerPanel.vue'

const message = useMessage()
const router = useRouter()
const promptStore = usePromptStore()
const settingsStore = useSettingsStore()

const showOptimizer = ref(false)

// 新消息输入
const newUserMessage = ref('')
const currentAttachments = ref<MessageAttachment[]>([])
const showAllCurrentAttachments = ref(false)
const showImagePreview = ref(false)
const previewImages = ref<string[]>([])
const previewIndex = ref(0)
const previewScale = ref(1)
const previewNaturalWidth = ref(0)
const previewNaturalHeight = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)

watch(
  () => currentAttachments.value.length,
  (len) => {
    if (len <= 1) showAllCurrentAttachments.value = false
  }
)

function triggerFileUpload() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue

    if (!file.type.startsWith('image/')) {
      message.warning(`File ${file.name} is not an image`)
      continue
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      currentAttachments.value.push({
        id: nanoid(),
        type: 'image',
        content,
        name: file.name,
        mimeType: file.type
      })
    }
    reader.readAsDataURL(file)
  }
  // reset input
  target.value = ''
}

function removeAttachment(index: number) {
  currentAttachments.value.splice(index, 1)
}

function openImagePreview(images: string[], index: number) {
  previewImages.value = images
  previewIndex.value = Math.min(Math.max(index, 0), Math.max(images.length - 1, 0))
  previewScale.value = 1
  previewNaturalWidth.value = 0
  previewNaturalHeight.value = 0
  showImagePreview.value = true
}

function closeImagePreview() {
  showImagePreview.value = false
}

const currentPreviewSrc = computed(() => previewImages.value[previewIndex.value] || '')

function setPreviewIndex(nextIndex: number) {
  const total = previewImages.value.length
  if (total <= 0) return
  previewIndex.value = ((nextIndex % total) + total) % total
  previewScale.value = 1
  previewNaturalWidth.value = 0
  previewNaturalHeight.value = 0
}

function prevPreview() {
  setPreviewIndex(previewIndex.value - 1)
}

function nextPreview() {
  setPreviewIndex(previewIndex.value + 1)
}

function zoomTo(scale: number) {
  previewScale.value = Math.min(5, Math.max(0.1, scale))
}

function zoomIn() {
  zoomTo(previewScale.value + 0.1)
}

function zoomOut() {
  zoomTo(previewScale.value - 0.1)
}

function resetZoom() {
  zoomTo(1)
}

function fitToScreen() {
  const w = previewNaturalWidth.value
  const h = previewNaturalHeight.value
  if (!w || !h) {
    resetZoom()
    return
  }
  const maxW = window.innerWidth * 0.85
  const maxH = window.innerHeight * 0.65
  zoomTo(Math.min(maxW / w, maxH / h))
}

function onPreviewImageLoad(e: Event) {
  const img = e.target as HTMLImageElement | null
  if (!img) return
  previewNaturalWidth.value = img.naturalWidth || 0
  previewNaturalHeight.value = img.naturalHeight || 0
}

function handleViewerWheel(e: WheelEvent) {
  if (!showImagePreview.value) return
  if (e.deltaY < 0) zoomIn()
  else zoomOut()
}

function handleViewerKeydown(e: KeyboardEvent) {
  if (!showImagePreview.value) return
  if (e.key === 'Escape') {
    closeImagePreview()
    return
  }
  if (e.key === 'ArrowLeft') {
    prevPreview()
    return
  }
  if (e.key === 'ArrowRight') {
    nextPreview()
    return
  }
  if (e.key === '+' || e.key === '=') {
    zoomIn()
    return
  }
  if (e.key === '-' || e.key === '_') {
    zoomOut()
    return
  }
  if (e.key === '0') {
    resetZoom()
    return
  }
  if (e.key === 'f' || e.key === 'F') {
    fitToScreen()
  }
}

watch(
  () => showImagePreview.value,
  (show) => {
    if (show) window.addEventListener('keydown', handleViewerKeydown)
    else window.removeEventListener('keydown', handleViewerKeydown)
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleViewerKeydown)
})

function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      if (file) {
        // Prevent default paste behavior if it's an image
        // We don't want the image binary data to be pasted into the text area
        // event.preventDefault() 
        // Note: preventing default here might block text pasting if mixed, 
        // but usually for images we want to handle it manually.
        
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          currentAttachments.value.push({
            id: nanoid(),
            type: 'image',
            content,
            name: file.name || 'pasted-image.png',
            mimeType: file.type
          })
        }
        reader.readAsDataURL(file)
      }
    }
  }
}

// 运行
async function handleRun() {
  if (!settingsStore.currentApiKey) {
    message.warning('请先点击右上角设置 API Key')
    return
  }

  // 确保有用户消息
  if (promptStore.messages.length === 0 && !newUserMessage.value.trim() && currentAttachments.value.length === 0) {
    message.warning('请输入消息或上传图片')
    return
  }

  // 如果有新消息，添加到消息列表
  if (newUserMessage.value.trim() || currentAttachments.value.length > 0) {
    promptStore.addUserMessage(newUserMessage.value.trim(), [...currentAttachments.value])
    newUserMessage.value = ''
    currentAttachments.value = []
  }

  const builtMessages = promptStore.getBuiltMessages()
  if (builtMessages.filter(m => m.role !== 'system').length === 0) {
    message.warning('请输入消息')
    return
  }

  promptStore.setRunning(true)
  const startTime = Date.now()

  try {
    const client = createLLMClient(
      settingsStore.currentProvider,
      settingsStore.currentApiKey,
      settingsStore.currentBaseUrl
    )

    await client.chatStream(
      {
        messages: builtMessages,
        model: settingsStore.currentModel,
        params: settingsStore.params
      },
      {
        onToken: (token) => {
          promptStore.appendOutput(token)
        },
        onComplete: (response) => {
          const duration = Date.now() - startTime
          const result: RunResult = {
            id: nanoid(),
            sessionId: 'current',
            input: builtMessages,
            output: response.content,
            model: settingsStore.currentModel,
            tokenUsage: response.tokenUsage,
            duration,
            timestamp: Date.now()
          }
          promptStore.addRunResult(result)
          promptStore.setRunning(false)
        },
        onError: (error) => {
          message.error(`Error: ${error.message}`)
          promptStore.setRunning(false)
        }
      }
    )
  } catch (error) {
    message.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    promptStore.setRunning(false)
  }
}

// 清空对话
function handleClear() {
  promptStore.clearMessages()
  message.success('对话已清空')
}
</script>

<template>
  <n-layout class="layout" has-sider>
    <!-- 左侧边栏 -->
    <n-layout-sider
      bordered
      :width="280"
      :collapsed-width="0"
      show-trigger
      collapse-mode="width"
    >
      <div class="sider-content">
        <VariablePanel id="tour-variable-panel" />
        <n-divider />
        <TokenStats />
      </div>
    </n-layout-sider>

    <!-- 主内容区 -->
    <n-layout>
      <!-- 顶部栏 -->
      <n-layout-header bordered class="header">
        <div class="header-left">
          <h2>Prompt Playground</h2>
        </div>
        <div class="header-right">
          <n-space>
            <n-button @click="startTour">
              <template #icon>
                <n-icon><HelpCircleOutline /></n-icon>
              </template>
              新手引导
            </n-button>
            <n-button @click="router.push('/test-cases')" id="tour-test-cases">
              <template #icon>
                <n-icon><ListOutline /></n-icon>
              </template>
              测试用例
            </n-button>
            <ModelSelector id="tour-model-selector" />
          </n-space>
        </div>
      </n-layout-header>

      <n-layout has-sider>
        <!-- 中间编辑区 -->
        <n-layout-content class="main-content">
          <n-scrollbar style="max-height: 100%">
            <div class="editor-area">
              <!-- System Prompt -->
              <SystemPrompt id="tour-system-prompt" />

              <div style="margin-bottom: 8px;" id="tour-optimizer">
                <n-button size="small" dashed type="primary" @click="showOptimizer = !showOptimizer" style="width: 100%">
                  <template #icon>
                    <n-icon><div class="i-carbon-magic-wand" /></n-icon>
                  </template>
                  {{ showOptimizer ? '隐藏提示词优化器' : '✨ 打开提示词优化器 (双阶段)' }}
                </n-button>
                <n-collapse-transition :show="showOptimizer">
                  <OptimizerPanel />
                </n-collapse-transition>
              </div>

              <!-- 消息列表 -->
              <ChatMessages />

              <!-- 当前输出（流式） -->
              <ResultPanel />

              <!-- 新消息输入 -->
              <div class="new-message">
                <!-- 附件预览 -->
                <div v-if="currentAttachments.length > 0" class="attachment-preview">
                  <template v-if="currentAttachments.length > 1 && !showAllCurrentAttachments">
                    <div class="preview-item" @click="showAllCurrentAttachments = true">
                      <img :src="currentAttachments[0]!.content" :alt="currentAttachments[0]!.name || ''" />
                      <div class="image-count-overlay">
                        +{{ currentAttachments.length - 1 }}
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div
                      v-if="currentAttachments.length > 1"
                      style="width: 100%; display: flex; justify-content: flex-end;"
                    >
                      <n-button text size="tiny" @click="showAllCurrentAttachments = false">折叠</n-button>
                    </div>
                    <div v-for="(att, index) in currentAttachments" :key="att.id" class="preview-item">
                      <img
                        :src="att.content"
                        :alt="att.name"
                        @click="openImagePreview(currentAttachments.map(a => a.content), index)"
                        style="cursor: pointer;"
                      />
                      <div class="preview-remove" @click="removeAttachment(index)">
                        <n-icon><CloseCircleOutline /></n-icon>
                      </div>
                    </div>
                  </template>
                </div>

                <div class="input-container">
                  <n-button quaternary circle class="upload-btn" @click="triggerFileUpload">
                    <template #icon>
                      <n-icon><ImageOutline /></n-icon>
                    </template>
                  </n-button>
                  <n-input
                    v-model:value="newUserMessage"
                    type="textarea"
                    placeholder="输入消息... (支持变量 {{variable}}, 支持粘贴图片)"
                    :autosize="{ minRows: 3, maxRows: 6 }"
                    @keydown.ctrl.enter="handleRun"
                    @paste="handlePaste"
                    class="message-input"
                  />
                </div>
                <input
                  type="file"
                  ref="fileInput"
                  style="display: none"
                  accept="image/*"
                  multiple
                  @change="handleFileSelect"
                />
              </div>

              <n-modal
                v-model:show="showImagePreview"
                preset="card"
                style="width: min(92vw, 980px);"
                @after-leave="resetZoom"
              >
                <div class="image-viewer" @wheel.prevent="handleViewerWheel">
                  <div class="image-viewer-toolbar">
                    <div class="image-viewer-status">
                      {{ previewImages.length ? `${previewIndex + 1} / ${previewImages.length}` : '' }}
                    </div>
                    <div class="image-viewer-actions">
                      <n-button size="small" :disabled="previewImages.length <= 1" @click="prevPreview">上一张</n-button>
                      <n-button size="small" :disabled="previewImages.length <= 1" @click="nextPreview">下一张</n-button>
                      <n-button size="small" @click="zoomOut">-</n-button>
                      <n-button size="small" @click="zoomIn">+</n-button>
                      <n-button size="small" @click="resetZoom">100%</n-button>
                      <n-button size="small" @click="fitToScreen">适配</n-button>
                      <n-button size="small" @click="closeImagePreview">关闭</n-button>
                    </div>
                  </div>
                  <div class="image-viewer-stage">
                    <div v-if="previewImages.length" class="image-viewer-index">
                      {{ previewIndex + 1 }}/{{ previewImages.length }}
                    </div>
                    <img
                      :src="currentPreviewSrc"
                      alt="preview"
                      class="image-viewer-img"
                      :style="{ transform: `scale(${previewScale})` }"
                      @load="onPreviewImageLoad"
                      @dblclick="resetZoom"
                    />
                  </div>
                </div>
              </n-modal>

              <!-- 操作按钮 -->
              <div class="actions">
                <n-space>
                  <n-button
                    id="tour-run-btn"
                    type="primary"
                    :loading="promptStore.isRunning"
                    @click="handleRun"
                  >
                    <template #icon>
                      <n-icon><PlayOutline /></n-icon>
                    </template>
                    运行 (Ctrl+Enter)
                  </n-button>
                  <n-popconfirm @positive-click="handleClear">
                    <template #trigger>
                      <n-button>
                        <template #icon>
                          <n-icon><TrashOutline /></n-icon>
                        </template>
                        清空
                      </n-button>
                    </template>
                    确定要清空所有对话吗？
                  </n-popconfirm>
                </n-space>
              </div>
            </div>
          </n-scrollbar>
        </n-layout-content>

        <!-- 右侧参数面板 -->
        <n-layout-sider
          bordered
          :width="280"
          :collapsed-width="0"
          show-trigger="bar"
          collapse-mode="width"
        >
          <ParamsPanel id="tour-params-panel" />
        </n-layout-sider>
      </n-layout>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.layout {
  height: 100vh;
}

.sider-content {
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
}

.main-content {
  height: calc(100vh - 56px);
}

.editor-area {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.new-message {
  margin-top: 8px;
}

.input-container {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.upload-btn {
  margin-top: 2px;
}

.message-input {
  flex: 1;
}

.attachment-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.preview-item {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-count-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  border-radius: 4px;
  backdrop-filter: blur(2px);
  cursor: pointer;
}

.preview-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-remove:hover {
  color: #fff;
  background: rgba(255, 0, 0, 0.8);
}

.actions {
  margin-top: 8px;
}

.image-viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.image-viewer-status {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.image-viewer-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.image-viewer-stage {
  height: 70vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
}

.image-viewer-index {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
}

.image-viewer-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center center;
  user-select: none;
}
</style>
