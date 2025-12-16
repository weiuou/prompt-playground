<script setup lang="ts">
import { usePromptStore } from '@/stores/prompt'

const promptStore = usePromptStore()
</script>

<template>
  <div class="token-stats" v-if="promptStore.latestResult">
    <h4>Token 统计</h4>
    <p>Prompt: {{ promptStore.latestResult.tokenUsage.promptTokens }}</p>
    <p>Completion: {{ promptStore.latestResult.tokenUsage.completionTokens }}</p>
    <p>Total: {{ promptStore.latestResult.tokenUsage.totalTokens }}</p>
    <p>耗时: {{ (promptStore.latestResult.duration / 1000).toFixed(2) }}s</p>
  </div>
</template>

<style scoped>
.token-stats {
  font-size: 13px;
  margin-top: 24px;
}

.token-stats h4 {
  margin-bottom: 8px;
  font-weight: 600;
}

.token-stats p {
  margin: 4px 0;
  color: #888;
}
</style>
