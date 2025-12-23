<script setup lang="ts">
import { usePromptStore } from '@/stores/prompt'
import {
  NInput,
  NButton,
  NIcon,
  NCollapse,
  NCollapseItem,
  NModal
} from 'naive-ui'
import { TrashOutline } from '@vicons/ionicons5'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const promptStore = usePromptStore()
const showImagePreview = ref(false)
const previewImages = ref<string[]>([])
const previewIndex = ref(0)
const previewScale = ref(1)
const previewNaturalWidth = ref(0)
const previewNaturalHeight = ref(0)

// 辅助函数：解析消息内容，分离 <think> 块
function parseMessage(content: string) {
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/)
  if (thinkMatch) {
    const thinking = thinkMatch[1]?.trim() || ''
    const answer = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim()
    return { thinking, answer }
  }
  return { thinking: null, answer: content }
}

function getImages(msg: any) {
  if (!msg.attachments) return []
  return msg.attachments.filter((a: any) => a.type === 'image')
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
</script>

<template>
  <div class="messages-list">
    <div
      v-for="msg in promptStore.messages"
      :key="msg.id"
      class="message-item"
      :class="msg.role"
    >
      <div class="message-header">
        <span class="role-label">{{ msg.role }}</span>
        <n-button
          size="tiny"
          quaternary
          @click="promptStore.deleteMessage(msg.id)"
        >
          <template #icon>
            <n-icon><TrashOutline /></n-icon>
          </template>
        </n-button>
      </div>

      <!-- 如果是 assistant 且包含 thinking，显示折叠面板和 clean content -->
      <div v-if="msg.role === 'assistant' && parseMessage(msg.content).thinking" style="margin-bottom: 8px;">
         <n-collapse style="margin-bottom: 8px;">
          <n-collapse-item title="Thinking Process" name="thinking">
            <div class="thinking-content">{{ parseMessage(msg.content).thinking }}</div>
          </n-collapse-item>
        </n-collapse>
        <div class="message-content-preview">
          {{ parseMessage(msg.content).answer }}
        </div>
        <n-button text size="tiny" type="primary" @click="(msg as any).showRaw = !(msg as any).showRaw" style="margin-top: 4px;">
          {{ (msg as any).showRaw ? 'Hide Raw' : 'Edit Raw Content' }}
        </n-button>
      </div>

      <!-- 图片附件显示 -->
      <div v-if="getImages(msg).length > 0" class="message-attachments">
        <template v-if="getImages(msg).length > 1 && !(msg as any).showAllImages">
          <div class="attachment-item" style="position: relative;">
            <img :src="getImages(msg)[0].content" :alt="getImages(msg)[0].name" />
            <div class="image-count-overlay" @click="(msg as any).showAllImages = true">
              +{{ getImages(msg).length - 1 }}
            </div>
          </div>
        </template>
        <template v-else>
          <div
            v-if="getImages(msg).length > 1 && (msg as any).showAllImages"
            style="width: 100%; display: flex; justify-content: flex-end;"
          >
            <n-button text size="tiny" @click="(msg as any).showAllImages = false">折叠</n-button>
          </div>
          <div v-for="(att, idx) in getImages(msg)" :key="att.id" class="attachment-item">
            <img
              :src="att.content"
              :alt="att.name"
              @click="openImagePreview(getImages(msg).map((a: any) => a.content), idx)"
              style="cursor: pointer;"
            />
          </div>
        </template>
      </div>

      <!-- 默认显示原始文本框 -->
      <n-input
        v-if="!(msg.role === 'assistant' && parseMessage(msg.content).thinking) || (msg as any).showRaw"
        v-model:value="msg.content"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 10 }"
        placeholder="Content"
      />
    </div>
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
</template>

<style scoped>
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  border-radius: 8px;
  padding: 12px;
}

.message-item.user {
  background: rgba(64, 128, 255, 0.1);
}

.message-item.assistant {
  background: rgba(80, 200, 120, 0.1);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.message-attachments {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.attachment-item img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.role-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: #888;
}

.thinking-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #666;
  font-size: 0.9em;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #eee;
  max-height: 200px;
  overflow-y: auto;
}

.message-content-preview {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 5px 12px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #eee;
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
  font-size: 24px;
  font-weight: bold;
  border-radius: 4px;
  backdrop-filter: blur(2px);
  cursor: pointer;
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
