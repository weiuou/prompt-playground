<script setup lang="ts">
import { usePromptStore } from '@/stores/prompt'
import { useOptimizerStore } from '@/stores/optimizer'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { ref } from 'vue'
import {
  NSpace,
  NInput,
  NButton,
  NIcon,
  NDivider,
  NCode
} from 'naive-ui'
import {
  TrashOutline,
  AddOutline,
  CloudUploadOutline,
  CloudDownloadOutline
} from '@vicons/ionicons5'

const promptStore = usePromptStore()
const optimizerStore = useOptimizerStore()
const { state: optimizerState } = storeToRefs(optimizerStore)
const message = useMessage()
const fileInput = ref<HTMLInputElement | null>(null)

function handleImportClick() {
  fileInput.value?.click()
}

function handleExportClick() {
  if (promptStore.variables.length === 0) {
    message.warning('没有可导出的变量')
    return
  }

  try {
    const headers = 'name,value'
    const rows = promptStore.variables.map(v => {
      // 简单处理 value 中可能包含的逗号和换行，用引号包裹
      const safeValue = v.value.includes(',') || v.value.includes('\n') 
        ? `"${v.value.replace(/"/g, '""')}"` 
        : v.value
      return `${v.name},${safeValue}`
    })
    
    const csvContent = [headers, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `variables_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    message.success('导出成功')
  } catch (error) {
    console.error('Export error:', error)
    message.error('导出失败')
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 重置 input，允许重复选择同一文件
  target.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) {
      parseAndImportCsv(text)
    }
  }
  reader.readAsText(file)
}

function parseAndImportCsv(content: string) {
  try {
    const lines = content.split(/\r?\n/).filter(line => line.trim())
    let count = 0
    
    // 简单的 CSV 解析：变量名,变量值
    // 如果第一行是 name,value 则跳过
    const startIndex = (lines[0]?.toLowerCase().startsWith('name,value') || lines[0]?.toLowerCase() === 'name,value') ? 1 : 0

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // 处理简单的逗号分割，暂不支持带逗号的 Quoted string 复杂情况，除非使用专门库
      // 这里做一个简单的优化：只分割第一个逗号
      const firstCommaIndex = trimmedLine.indexOf(',')
      let name = ''
      let value = ''

      if (firstCommaIndex === -1) {
        name = trimmedLine
      } else {
        name = trimmedLine.substring(0, firstCommaIndex).trim()
        value = trimmedLine.substring(firstCommaIndex + 1).trim()
        
        // 去除可能的引号包裹
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1).replace(/""/g, '"')
        }
      }
      
      name = name.trim()
      if (!name) continue

      // 检查是否存在，存在则更新，不存在则添加
      const existingIdx = promptStore.variables.findIndex(v => v.name === name)
      if (existingIdx !== -1) {
        promptStore.updateVariable(existingIdx, name, value)
      } else {
        promptStore.addVariable(name, value)
      }
      count++
    }
    
    if (count > 0) {
      message.success(`成功导入 ${count} 个变量`)
    } else {
      message.warning('未找到有效变量数据')
    }
  } catch (error) {
    console.error('CSV Import Error:', error)
    message.error('导入失败：文件格式错误')
  }
}
</script>

<template>
  <div class="variable-panel">
    <h3 class="panel-title">Variables</h3>
    <n-space vertical>
      <div
        v-for="(_v, index) in promptStore.variables"
        :key="index"
        class="variable-item"
      >
        <n-input
          v-if="promptStore.variables[index]"
          v-model:value="promptStore.variables[index]!.name"
          placeholder="变量名"
          size="small"
          style="width: 80px"
        />
        <n-input
          v-if="promptStore.variables[index]"
          v-model:value="promptStore.variables[index]!.value"
          placeholder="值"
          size="small"
          style="flex: 1"
        />
        <n-button
          size="small"
          quaternary
          @click="promptStore.deleteVariable(index)"
        >
          <template #icon>
            <n-icon><TrashOutline /></n-icon>
          </template>
        </n-button>
      </div>
      <div style="display: flex; gap: 8px;">
        <n-button size="small" dashed @click="promptStore.addVariable()" style="flex: 1">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          添加变量
        </n-button>
        <n-button size="small" dashed @click="handleImportClick" title="导入 CSV">
          <template #icon>
            <n-icon><CloudUploadOutline /></n-icon>
          </template>
        </n-button>
        <n-button size="small" dashed @click="handleExportClick" title="导出 CSV">
          <template #icon>
            <n-icon><CloudDownloadOutline /></n-icon>
          </template>
        </n-button>
        <input
          type="file"
          ref="fileInput"
          style="display: none"
          accept=".csv,.txt"
          @change="handleFileChange"
        />
      </div>
    </n-space>

    <!-- Optimizer Variables Section -->
    <div v-if="optimizerState.currentVariables && Object.keys(optimizerState.currentVariables).length > 0">
      <n-divider style="margin: 16px 0;" />
      <h3 class="panel-title">Optimizer Variables</h3>
      <n-space vertical>
        <div v-for="(val, key) in optimizerState.currentVariables" :key="key" class="opt-variable-item">
          <div class="opt-var-name">{{ key }}</div>
          <n-code 
            :code="val || '(Empty)'" 
            language="text" 
            word-wrap 
            style="max-height: 100px; overflow-y: auto; font-size: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; padding: 4px;" 
          />
        </div>
      </n-space>
    </div>
  </div>
</template>

<style scoped>
.panel-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
}

.variable-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.opt-variable-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.opt-var-name {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  font-family: monospace;
}
</style>
