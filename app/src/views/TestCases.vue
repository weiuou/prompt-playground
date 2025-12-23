<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NSpace,
  NCard,
  NInput,
  NIcon,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NDivider,
  NGrid,
  NGridItem,
  NUpload,
  type UploadFileInfo,
  useMessage
} from 'naive-ui'
import { AddOutline, ArrowBackOutline, TrashOutline, SettingsOutline, CloudDownloadOutline, CloudUploadOutline, CloseOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useTestCasesStore, type TestCase, type EvaluationType } from '@/stores/testCases'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useTestCasesStore()
const message = useMessage()
const { testCases } = storeToRefs(store)

// 编辑模态框
const showEditModal = ref(false)
const editingCase = ref<TestCase | null>(null)
const showAllEditingImages = ref(false)

const showImagePreview = ref(false)
const previewImages = ref<string[]>([])
const previewIndex = ref(0)
const previewScale = ref(1)
const previewNaturalWidth = ref(0)
const previewNaturalHeight = ref(0)

function getCaseImages(c: any): string[] {
  if (c?.imageUrls && Array.isArray(c.imageUrls) && c.imageUrls.length > 0) return c.imageUrls
  if (c?.imageUrl) return [c.imageUrl]
  return []
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

watch(
  () => editingCase.value?.imageUrls?.length,
  (len) => {
    if (!len || len <= 1) showAllEditingImages.value = false
  }
)

// 监听评估类型变化，自动初始化对应的 Config
watch(() => editingCase.value?.evaluation.type, (newType) => {
  if (!editingCase.value || !newType) return
  
  const evalConfig = editingCase.value.evaluation
  
  if (newType === 'rule' && !evalConfig.ruleConfig) {
    evalConfig.ruleConfig = { operator: 'contains', value: '' }
  }
  
  if (newType === 'code' && !evalConfig.codeConfig) {
    evalConfig.codeConfig = { language: 'javascript', code: '' }
  }
  
  if (newType === 'ai_judge' && !evalConfig.aiConfig) {
    evalConfig.aiConfig = { prompt: '', rubric: '' }
  }
  
  if (newType === 'human' && !evalConfig.humanConfig) {
    evalConfig.humanConfig = { description: '' }
  }
})

// 评估类型选项
const evaluationTypeOptions = [
  { label: '规则匹配 (Rule)', value: 'rule' },
  { label: 'AI 裁判 (LLM Judge)', value: 'ai_judge' },
  { label: '代码执行 (Code)', value: 'code' },
  { label: '人工评审 (Human)', value: 'human' }
]

// 规则操作符选项
const ruleOperatorOptions = [
  { label: '包含 (Contains)', value: 'contains' },
  { label: '不包含 (Not Contains)', value: 'not_contains' },
  { label: '完全相等 (Equals)', value: 'equals' },
  { label: '正则匹配 (Regex)', value: 'regex' }
]

function handleEdit(c: TestCase) {
  // 深拷贝以避免直接修改 Store
  editingCase.value = JSON.parse(JSON.stringify(c))
  // Ensure imageUrls exists
  if (editingCase.value && !editingCase.value.imageUrls) {
      editingCase.value.imageUrls = []
  }
  // Migrate legacy single image if present
  if (editingCase.value && (editingCase.value as any).imageUrl) {
      editingCase.value.imageUrls?.push((editingCase.value as any).imageUrl)
      delete (editingCase.value as any).imageUrl
  }
  showAllEditingImages.value = false
  showEditModal.value = true
}

function handleCloseModal() {
  showEditModal.value = false
  showAllEditingImages.value = false
  editingCase.value = null
}

function handleSave() {
  if (editingCase.value) {
    store.updateTestCase(editingCase.value.id, editingCase.value)
  }
  handleCloseModal()
}

function handleAdd() {
  store.addTestCase({ imageUrls: [] })
  // 自动打开刚添加的 Case 进行编辑
  const newCase = store.testCases[store.testCases.length - 1]
  if (newCase) {
    handleEdit(newCase)
  }
}

function getEvaluationLabel(type: EvaluationType) {
  return evaluationTypeOptions.find(o => o.value === type)?.label || type
}

// 导出 JSON
function handleExport() {
  const data = JSON.stringify(testCases.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `test-cases-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.success('导出成功')
}

// 导入 JSON
function handleImport(options: { file: UploadFileInfo }) {
  const file = options.file.file
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        // 简单的校验：检查是否有 id 和 input
        const valid = parsed.every((item: any) => item.id && typeof item.input === 'string')
        if (valid) {
          // 替换当前数据（或者可以选择合并）
          // 这里我们采用合并策略：id 相同则覆盖，不同则添加
          let addedCount = 0
          let updatedCount = 0
          
          parsed.forEach((newItem: TestCase) => {
            const index = store.testCases.findIndex(c => c.id === newItem.id)
            if (index !== -1) {
              store.updateTestCase(newItem.id, newItem)
              updatedCount++
            } else {
              // 必须使用 store action 以确保响应式
              // 但 store.addTestCase 会生成新 ID，我们需要保留导入的 ID
              // 这里的 addTestCase 实现实际上是生成新 ID 的，所以我们可能需要直接操作 store state 或者修改 action
              // 让我们暂时使用 update 逻辑覆盖，对于新项，我们手动 push 到 store.testCases 
              // (注意：直接修改 store state 在 pinia 中是允许的，但最好通过 action)
              // 为了简单，我们直接覆盖整个列表，或者请求用户确认。
              // 更好的体验是：合并。
              // 由于 store.addTestCase 强制生成新 ID，我们无法保留原 ID。
              // 让我们修改 store.addTestCase 或者直接操作 store.testCases (如果 storeToRefs 返回的是 ref)
              
              // Pinia store state is reactive. We can push directly if we want to keep ID.
              store.testCases.push(newItem)
              addedCount++
            }
          })
          message.success(`导入成功：新增 ${addedCount} 条，更新 ${updatedCount} 条`)
        } else {
          message.error('文件格式不正确：必须是 TestCases 数组')
        }
      } else {
        message.error('文件格式不正确：必须是 JSON 数组')
      }
    } catch (err) {
      message.error('解析 JSON 失败')
      console.error(err)
    }
  }
  reader.readAsText(file)
  return false // 阻止默认上传行为
}

function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      if (file && editingCase.value) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          if (editingCase.value) {
             if (!editingCase.value.imageUrls) {
                 editingCase.value.imageUrls = []
             }
             editingCase.value.imageUrls.push(content)
          }
        }
        reader.readAsDataURL(file)
      }
    }
  }
}

function removeImage(index: number) {
    if (editingCase.value && editingCase.value.imageUrls) {
        editingCase.value.imageUrls.splice(index, 1)
    }
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
        <h2>测试用例管理</h2>
      </div>
      <div class="header-right">
        <n-space>
          <n-upload
            :show-file-list="false"
            @change="handleImport"
            accept=".json"
          >
            <n-button secondary>
              <template #icon><n-icon><CloudUploadOutline /></n-icon></template>
              导入
            </n-button>
          </n-upload>

          <n-button secondary @click="handleExport">
            <template #icon><n-icon><CloudDownloadOutline /></n-icon></template>
            导出
          </n-button>

          <n-button type="primary" @click="handleAdd">
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            添加用例
          </n-button>
        </n-space>
      </div>
    </n-layout-header>

    <n-layout-content class="content">
      <div class="case-grid">
        <n-card v-for="c in testCases" :key="c.id" size="small" class="case-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">{{ c.name }}</span>
              <n-tag size="small" type="info">{{ getEvaluationLabel(c.evaluation.type) }}</n-tag>
            </div>
          </template>
          <template #header-extra>
            <n-space>
              <n-button size="tiny" secondary @click="handleEdit(c)">
                <template #icon><n-icon><SettingsOutline /></n-icon></template>
                配置
              </n-button>
              <n-button size="tiny" quaternary type="error" @click="store.removeTestCase(c.id)">
                <template #icon><n-icon><TrashOutline /></n-icon></template>
              </n-button>
            </n-space>
          </template>
          
          <div class="card-body">
            <div class="field">
              <label>输入:</label>
              <div class="value text-truncate">{{ c.input }}</div>
              
              <div v-if="getCaseImages(c).length > 0" style="margin-top: 4px;">
                <div class="case-image-thumb" @click="openImagePreview(getCaseImages(c), 0)">
                  <img :src="getCaseImages(c)[0]" alt="case-image" />
                  <div v-if="getCaseImages(c).length > 1" class="image-count-overlay">
                    +{{ getCaseImages(c).length - 1 }}
                  </div>
                </div>
              </div>
            </div>
            <div class="field">
              <label>预期:</label>
              <div class="value text-truncate">{{ c.expectedOutput || '(无)' }}</div>
            </div>
          </div>
        </n-card>
      </div>
    </n-layout-content>

    <!-- 编辑模态框 -->
    <n-modal v-model:show="showEditModal" preset="card" title="编辑测试用例" style="width: 800px; max-width: 90vw;">
      <n-form v-if="editingCase" label-placement="left" label-width="100">
        <n-form-item label="名称">
          <n-input v-model:value="editingCase.name" placeholder="用例名称" />
        </n-form-item>
        
        <n-grid :cols="2" :x-gap="12">
          <n-grid-item>
            <n-form-item label="输入">
              <div style="width: 100%">
                <div v-if="editingCase.imageUrls && editingCase.imageUrls.length > 0" style="margin-bottom: 8px;">
                  <template v-if="editingCase.imageUrls.length > 1 && !showAllEditingImages">
                    <div class="edit-image-collapsed" @click="showAllEditingImages = true">
                      <img :src="editingCase.imageUrls[0]" alt="case-image" />
                      <div class="image-count-overlay">
                        +{{ editingCase.imageUrls.length - 1 }}
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div
                      v-if="editingCase.imageUrls.length > 1"
                      style="width: 100%; display: flex; justify-content: flex-end; margin-bottom: 6px;"
                    >
                      <n-button text size="tiny" @click="showAllEditingImages = false">折叠</n-button>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <div v-for="(url, idx) in editingCase.imageUrls" :key="idx" class="edit-image-item">
                        <img
                          :src="url"
                          alt="case-image"
                          @click="openImagePreview(editingCase.imageUrls, idx)"
                          style="cursor: pointer;"
                        />
                        <n-button
                          circle
                          type="error"
                          size="tiny"
                          class="edit-image-remove"
                          @click.stop="removeImage(idx)"
                        >
                          <template #icon><n-icon><CloseOutline /></n-icon></template>
                        </n-button>
                      </div>
                    </div>
                  </template>
                </div>
                <n-input 
                  v-model:value="editingCase.input" 
                  type="textarea" 
                  :autosize="{ minRows: 3, maxRows: 6 }" 
                  placeholder="Prompt 输入变量 (支持 Ctrl+V 粘贴图片)" 
                  @paste="handlePaste"
                />
              </div>
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="预期输出">
              <n-input v-model:value="editingCase.expectedOutput" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="参考答案 (可选)" />
            </n-form-item>
          </n-grid-item>
        </n-grid>

        <n-divider title-placement="left">评估配置</n-divider>

        <n-form-item label="评估类型">
          <n-select v-model:value="editingCase.evaluation.type" :options="evaluationTypeOptions" />
        </n-form-item>

        <!-- 1. 规则配置 -->
        <div v-if="editingCase.evaluation.type === 'rule'">
          <n-form-item label="规则逻辑">
            <n-select 
              v-model:value="editingCase.evaluation.ruleConfig!.operator" 
              :options="ruleOperatorOptions" 
              style="width: 200px; margin-right: 12px;"
            />
            <n-input v-model:value="editingCase.evaluation.ruleConfig!.value" placeholder="匹配值 / 正则表达式" />
          </n-form-item>
        </div>

        <!-- 2. AI 裁判配置 -->
        <div v-if="editingCase.evaluation.type === 'ai_judge'">
          <n-form-item label="评分标准">
            <n-input 
              v-model:value="editingCase.evaluation.aiConfig!.rubric" 
              type="textarea" 
              :autosize="{ minRows: 3 }" 
              placeholder="例如：请从准确性、完整性、创造性三个维度打分，满分10分。" 
            />
          </n-form-item>
          <n-form-item label="自定义 Prompt">
            <n-input 
              v-model:value="editingCase.evaluation.aiConfig!.prompt" 
              type="textarea" 
              :autosize="{ minRows: 3 }" 
              placeholder="(可选) 完全覆盖默认的裁判 Prompt" 
            />
          </n-form-item>
        </div>

        <!-- 3. 代码执行配置 -->
        <div v-if="editingCase.evaluation.type === 'code'">
          <n-form-item label="语言">
            <n-select v-model:value="editingCase.evaluation.codeConfig!.language" :options="[{ label: 'JavaScript', value: 'javascript' }]" disabled />
          </n-form-item>
          <n-form-item label="检查脚本">
            <n-input 
              v-model:value="editingCase.evaluation.codeConfig!.code" 
              type="textarea" 
              :autosize="{ minRows: 5 }" 
              placeholder="function check(output, expected) { return output === expected; }" 
              style="font-family: monospace;"
            />
          </n-form-item>
          <div style="margin-left: 100px; margin-bottom: 12px; font-size: 0.9em; color: #666;">
            函数签名: <code>(output: string, expected: string) => boolean | { pass: boolean, score: number, reason: string }</code>
          </div>
        </div>

        <!-- 4. 人工配置 -->
        <div v-if="editingCase.evaluation.type === 'human'">
          <n-form-item label="评审指南">
            <n-input v-model:value="editingCase.evaluation.humanConfig!.description" type="textarea" placeholder="提示评审员应该关注什么..." />
          </n-form-item>
        </div>

      </n-form>
      <template #action>
        <n-button @click="handleCloseModal">取消</n-button>
        <n-button type="primary" @click="handleSave">保存</n-button>
      </template>
    </n-modal>

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
  gap: 12px;
}

.content {
  padding: 16px;
  /* background: #f0f2f5; Remove explicit light background */
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.case-card {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body .field {
  margin-bottom: 8px;
}

.card-body label {
  font-size: 12px;
  color: #888;
  font-weight: 600;
  display: block;
  margin-bottom: 2px;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  /* background: #fafafa; Use NInput styles or transparent */
  background: rgba(0, 0, 0, 0.02);
  padding: 4px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.case-image-thumb {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  display: inline-flex;
  cursor: pointer;
}

.case-image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.edit-image-collapsed {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  display: inline-flex;
  cursor: pointer;
}

.edit-image-collapsed img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.edit-image-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
}

.edit-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.edit-image-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
}

.image-count-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border-radius: 4px;
  pointer-events: none;
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
