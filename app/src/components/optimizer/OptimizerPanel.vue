<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NCard,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NSelect,
  NSlider,
  NButton,
  NInput,
  NProgress,
  NTabs,
  NTabPane,
  NLog,
  NModal,
  NAlert,
  NTimeline,
  NTimelineItem,
  NCode,
  useMessage
} from 'naive-ui'
import { useOptimizerStore } from '@/stores/optimizer'
import { useSettingsStore } from '@/stores/settings'
import { useTestCasesStore } from '@/stores/testCases'
import { usePromptStore } from '@/stores/prompt'
import { storeToRefs } from 'pinia'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import * as Diff from 'diff'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const optimizerStore = useOptimizerStore()
const settingsStore = useSettingsStore()
const testCasesStore = useTestCasesStore()
const promptStore = usePromptStore()
const message = useMessage()

const { config, state } = storeToRefs(optimizerStore)

const modelOptions = computed(() => {
  return settingsStore.availableModels.map(m => ({ label: m, value: m }))
})

// Template Editing
const showTemplateModal = ref(false)
const currentTemplateType = ref<'initial' | 'optimization'>('initial')
const tempTemplateContent = ref('')

function openTemplateEditor(type: 'initial' | 'optimization') {
  currentTemplateType.value = type
  tempTemplateContent.value = type === 'initial' ? config.value.initialTemplate : config.value.optimizationTemplate
  showTemplateModal.value = true
}

function saveTemplate() {
  if (currentTemplateType.value === 'initial') {
    optimizerStore.setConfig({ initialTemplate: tempTemplateContent.value })
  } else {
    optimizerStore.setConfig({ optimizationTemplate: tempTemplateContent.value })
  }
  showTemplateModal.value = false
}

// Actions
async function handleStart() {
  if (testCasesStore.testCases.length === 0) {
    message.warning('Please add test cases first (input and expected output).')
    return
  }
  try {
    await optimizerStore.startOptimization(testCasesStore.testCases)
  } catch (error) {
    message.error(`Start failed: ${error}`)
  }
}

function applyBestPrompt() {
  promptStore.setSystemPrompt(state.value.bestPrompt)
  if (state.value.bestParams) {
    // Apply params if needed (Currently PromptStore might not expose direct param setters, 
    // assuming SettingsStore is the source of truth for params)
    // We should update SettingsStore params
    settingsStore.updateParams(state.value.bestParams)
    message.success('已应用最佳提示词和参数！')
  } else {
    message.success('已应用最佳提示词！')
  }
}

const progressPct = computed(() => {
  if (config.value.maxSteps === 0) return 0
  return Math.min(100, Math.round((state.value.currentStep / config.value.maxSteps) * 100))
})

const logString = computed(() => {
  return state.value.logs.map(l => `[${l.type.toUpperCase()}] ${l.message}`).join('\n')
})

const chartOption = computed(() => {
  const steps = state.value.history.map(h => `Step ${h.step}`)
  const scores = state.value.history.map(h => (h.score * 100).toFixed(1))
  
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const historyItem = state.value.history[idx]
        if (!historyItem) return ''
        
        let html = `Step ${historyItem.step}<br/>Score: ${(historyItem.score * 100).toFixed(1)}%`
        if (historyItem.params && Object.keys(historyItem.params).length > 0) {
          html += '<br/>Params:<br/>'
          const paramsObj = historyItem.params as Record<string, any>
          html += Object.entries(paramsObj).map(([k, v]) => `- ${k}: ${v}`).join('<br/>')
        }
        return html
      }
    },
    xAxis: {
      type: 'category',
      data: steps
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100
    },
    series: [
      {
        data: scores,
        type: 'line',
        smooth: true,
        name: 'Score'
      }
    ]
  }
})

// Diff Viewer
const showDiffModal = ref(false)
const diffLeftStep = ref<number | null>(null)
const diffRightStep = ref<number | null>(null)

function openDiffModal() {
  if (state.value.history.length < 2) {
    message.warning('需要至少两个步骤才能进行对比。')
    return
  }
  // Default to comparing the last two steps or Best vs Initial
  diffLeftStep.value = 0
  diffRightStep.value = state.value.history.length - 1
  showDiffModal.value = true
}

const historyOptions = computed(() => {
  return state.value.history.map(h => ({
    label: `Step ${h.step} (Score: ${(h.score * 100).toFixed(1)}%)`,
    value: h.step
  }))
})

const interactionLogs = computed(() => {
  return state.value.logs.filter(l => l.details).reverse()
})

const diffHtml = computed(() => {
  if (diffLeftStep.value === null || diffRightStep.value === null) return ''
  
  const leftItem = state.value.history.find(h => h.step === diffLeftStep.value)
  const rightItem = state.value.history.find(h => h.step === diffRightStep.value)
  
  if (!leftItem || !rightItem) return ''
  
  const diff = Diff.diffChars(leftItem.prompt, rightItem.prompt)
  
  return diff.map((part: Diff.Change) => {
    // VS Code style diff colors (Dark theme)
    // Removed: Red background
    // Added: Green background
    const bgColor = part.added ? 'rgba(46, 160, 67, 0.3)' : part.removed ? 'rgba(248, 81, 73, 0.3)' : 'transparent'
    const textColor = part.added ? '#e6ffec' : part.removed ? '#ff7b72' : '#d4d4d4'
    const textDecoration = part.removed ? 'line-through' : 'none'
    // Basic escape
    const safeValue = part.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return `<span style="background-color: ${bgColor}; color: ${textColor}; text-decoration: ${textDecoration}">${safeValue}</span>`
  }).join('')
})
</script>

<template>
  <div class="optimizer-panel">
    <n-card title="提示词优化器 (双阶段)" size="small">
      <template #header-extra>
        <n-button text tag="a" href="https://github.com/weiuou/prompt-playground/blob/main/paper/acl_latex.pdf" target="_blank" type="primary">
          查看论文
        </n-button>
      </template>

      <n-collapse :default-expanded-names="['config']">
        <n-collapse-item title="配置" name="config">
          <n-alert type="info" title="注意" style="margin-bottom: 12px">
            优化器使用您的 <strong>测试用例</strong> ({{ testCasesStore.testCases.length }} 个示例) 来生成和评估提示词。
            请确保测试用例与您的目标任务匹配（例如：为情感分析提示词准备判断一段话是积极还是消极的示例）。
          </n-alert>
          <n-form label-placement="left" label-width="100">
            <n-form-item label="模型">
              <n-select v-model:value="config.modelId" :options="modelOptions" placeholder="选择模型" />
            </n-form-item>
            <n-form-item label="最大步数">
              <n-slider v-model:value="config.maxSteps" :min="1" :max="20" :step="1" />
              <span style="margin-left: 10px">{{ config.maxSteps }}</span>
            </n-form-item>
            <n-form-item label="元指令模板">
              <n-space vertical>
                <n-button size="small" @click="openTemplateEditor('initial')">编辑初始化模板</n-button>
                <n-button size="small" @click="openTemplateEditor('optimization')">编辑优化模板</n-button>
              </n-space>
            </n-form-item>
          </n-form>
        </n-collapse-item>
      </n-collapse>

      <n-space justify="end" style="margin-top: 16px;">
        <n-button 
          type="primary" 
          :loading="state.isOptimizing" 
          @click="handleStart"
          :disabled="state.isOptimizing"
        >
          {{ state.isOptimizing ? '正在优化...' : '开始优化' }}
        </n-button>
      </n-space>

      <div v-if="state.currentStep > 0 || state.isOptimizing || state.logs.length > 0" class="progress-section">
        <n-progress 
          type="line" 
          :percentage="progressPct" 
          indicator-placement="inside" 
          processing 
          style="margin: 16px 0;"
        />

        <div v-if="state.history.length > 0" style="height: 300px; margin-bottom: 16px;">
          <VChart class="chart" :option="chartOption" autoresize />
        </div>
        
        <n-tabs type="segment">
          <n-tab-pane name="logs" tab="运行日志">
            <n-log :log="logString" :rows="10" style="background: #f5f5f5; color: #333; padding: 8px; border-radius: 4px;" />
          </n-tab-pane>
          <n-tab-pane name="process" tab="优化过程详情">
            <div class="process-timeline">
              <n-timeline>
                <n-timeline-item
                  v-for="(log, index) in interactionLogs"
                  :key="index"
                  type="info"
                  :title="`优化建议 (Time: ${new Date(log.timestamp).toLocaleTimeString()})`"
                  :content="log.message"
                >
                  <n-collapse>
                    <n-collapse-item title="1. 失败案例分析 (Failures)" name="1">
                      <n-code :code="log.details?.failures || '无'" language="text" word-wrap />
                    </n-collapse-item>
                    <n-collapse-item title="2. 完整元提示词 (Meta Prompt)" name="2">
                      <n-code :code="log.details?.metaPrompt || '无'" language="markdown" word-wrap />
                    </n-collapse-item>
                    <n-collapse-item title="3. AI 回复 (LLM Output)" name="3">
                      <n-code :code="log.details?.llmOutput || '无'" language="json" word-wrap />
                    </n-collapse-item>
                  </n-collapse>
                </n-timeline-item>
                <div v-if="interactionLogs.length === 0" style="padding: 16px; color: #999; text-align: center;">
                  暂无交互详情（请先运行优化）
                </div>
              </n-timeline>
            </div>
          </n-tab-pane>
          <n-tab-pane name="current" tab="当前提示词">
            <n-input type="textarea" :value="state.currentPrompt" readonly autosize />
          </n-tab-pane>
          <n-tab-pane name="best" tab="最佳提示词">
            <div style="margin-bottom: 8px;">
              <strong>得分: {{ (state.bestScore * 100).toFixed(1) }}%</strong>
              <div v-if="state.bestParams && Object.keys(state.bestParams).length > 0" style="margin-top: 4px; font-size: 0.9em; color: #666;">
                 最佳参数: {{ JSON.stringify(state.bestParams) }}
              </div>
              <n-space style="margin-top: 8px;">
                <n-button size="tiny" type="success" @click="applyBestPrompt">应用</n-button>
                <n-button size="tiny" secondary type="info" @click="openDiffModal" :disabled="state.history.length < 2">
                  查看历史对比
                </n-button>
              </n-space>
            </div>
            <n-input type="textarea" :value="state.bestPrompt" readonly autosize />
          </n-tab-pane>
        </n-tabs>
      </div>
    </n-card>

    <!-- Template Editor Modal -->
    <n-modal v-model:show="showTemplateModal" preset="dialog" title="编辑元指令模板">
      <n-input
        v-model:value="tempTemplateContent"
        type="textarea"
        :autosize="{ minRows: 5, maxRows: 15 }"
        placeholder="输入元提示词模板..."
      />
      <template #action>
        <n-button @click="showTemplateModal = false">取消</n-button>
        <n-button type="primary" @click="saveTemplate">保存</n-button>
      </template>
    </n-modal>

    <!-- Diff Viewer Modal -->
    <n-modal v-model:show="showDiffModal" preset="card" title="提示词历史版本对比" style="width: 800px; max-width: 90vw;">
      <n-space vertical>
        <div style="display: flex; gap: 16px; align-items: center;">
          <n-select v-model:value="diffLeftStep" :options="historyOptions" placeholder="Base Version" />
          <span>vs</span>
          <n-select v-model:value="diffRightStep" :options="historyOptions" placeholder="Target Version" />
        </div>
        
        <div class="diff-container">
          <pre class="diff-content" v-html="diffHtml"></pre>
        </div>
      </n-space>
    </n-modal>
  </div>
</template>

<style scoped>
.optimizer-panel {
  margin-top: 16px;
}
.diff-container {
  max-height: 60vh;
  overflow-y: auto;
  background: #1e1e1e;
  padding: 16px;
  border-radius: 4px;
  border: 1px solid #333;
}
.diff-content {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  margin: 0;
  line-height: 1.6;
  color: #d4d4d4;
  font-size: 13px;
}
.process-timeline {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
  /* background: #fff;  Removed explicit white background */
  background: rgba(0, 0, 0, 0.02); /* Slight tint */
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
</style>
