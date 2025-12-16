<script setup lang="ts">
import { usePromptStore } from '@/stores/prompt'
import {
  NInput,
  NButton,
  NIcon,
  NCollapse,
  NCollapseItem
} from 'naive-ui'
import { TrashOutline } from '@vicons/ionicons5'

const promptStore = usePromptStore()

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
      <div v-if="msg.attachments && msg.attachments.length > 0" class="message-attachments">
        <div v-for="att in msg.attachments" :key="att.id" class="attachment-item">
          <img :src="att.content" :alt="att.name" v-if="att.type === 'image'" />
        </div>
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
</style>
