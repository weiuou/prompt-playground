<script setup lang="ts">
import { usePromptStore } from '@/stores/prompt'
import { NCard, NCollapse, NCollapseItem } from 'naive-ui'
import { computed } from 'vue'

const promptStore = usePromptStore()

// 简单的 <think> 标签解析器
const parsedOutput = computed(() => {
  const content = promptStore.currentOutput
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/)
  
  if (thinkMatch) {
    const thinking = thinkMatch[1]?.trim() || ''
    const answer = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim()
    return { thinking, answer }
  }
  
  return { thinking: null, answer: content }
})
</script>

<template>
  <div v-if="promptStore.isRunning || promptStore.currentOutput" class="current-output">
    <n-card title="Output" size="small">
      <div class="output-content">
        <!-- 思考过程折叠面板 -->
        <n-collapse v-if="parsedOutput.thinking" style="margin-bottom: 16px;">
          <n-collapse-item title="Thinking Process (Reasoning)" name="thinking">
            <div class="thinking-content">{{ parsedOutput.thinking }}</div>
          </n-collapse-item>
        </n-collapse>

        <!-- 最终回答 -->
        <div class="answer-content">
          {{ parsedOutput.answer }}
          <span v-if="promptStore.isRunning" class="cursor">▌</span>
        </div>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.current-output {
  margin-top: 8px;
}

.output-content {
  line-height: 1.6;
}

.thinking-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #666;
  font-size: 0.9em;
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  border-left: 3px solid #ccc;
}

.answer-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
