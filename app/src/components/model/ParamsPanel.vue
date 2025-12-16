<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import {
  NSlider,
  NInputNumber,
  NButton,
  NSwitch,
  NDivider,
  NTooltip,
  NIcon
} from 'naive-ui'
import { HelpCircleOutline } from '@vicons/ionicons5'

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="params-panel">
    <h3>Parameters</h3>

    <div class="param-item">
      <label>Temperature</label>
      <n-slider
        v-model:value="settingsStore.params.temperature"
        :min="0"
        :max="2"
        :step="0.1"
      />
      <n-input-number
        v-model:value="settingsStore.params.temperature"
        :min="0"
        :max="2"
        :step="0.1"
        size="small"
      />
    </div>

    <div class="param-item">
      <label>Max Tokens</label>
      <n-input-number
        v-model:value="settingsStore.params.maxTokens"
        :min="1"
        :max="128000"
        size="small"
      />
    </div>

    <div class="param-item">
      <label>Top P</label>
      <n-slider
        v-model:value="settingsStore.params.topP"
        :min="0"
        :max="1"
        :step="0.1"
      />
      <n-input-number
        v-model:value="settingsStore.params.topP"
        :min="0"
        :max="1"
        :step="0.1"
        size="small"
      />
    </div>

    <div class="param-item">
      <label>Frequency Penalty</label>
      <n-slider
        v-model:value="settingsStore.params.frequencyPenalty"
        :min="0"
        :max="2"
        :step="0.1"
      />
    </div>

    <div class="param-item">
      <label>Presence Penalty</label>
      <n-slider
        v-model:value="settingsStore.params.presencePenalty"
        :min="0"
        :max="2"
        :step="0.1"
      />
    </div>

    <n-button block @click="settingsStore.resetParams">
      重置参数
    </n-button>
    
    <n-divider />
    
    <div class="param-item">
       <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
         <div style="display: flex; align-items: center; gap: 4px;">
           <label style="margin-bottom: 0;">强制防缓存</label>
           <n-tooltip trigger="hover">
             <template #trigger>
               <n-icon size="14" color="#888"><HelpCircleOutline /></n-icon>
             </template>
             通过在请求中添加随机种子和隐藏的随机系统消息，强制 API 返回新的结果（适用于 DeepSeek 等容易缓存的第三方 API）。
           </n-tooltip>
         </div>
         <n-switch v-model:value="settingsStore.preventCache" size="small" />
       </div>
    </div>
  </div>
</template>

<style scoped>
.params-panel {
  padding: 16px;
}

.params-panel h3 {
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
}

.param-item {
  margin-bottom: 16px;
}

.param-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #888;
}
</style>
