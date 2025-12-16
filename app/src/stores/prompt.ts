import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage, Variable, RunResult, MessageAttachment } from '@/types'
import { nanoid } from '@/utils/nanoid'
import { applyVariables as applyTemplateVariables } from '@/utils/template'

export const usePromptStore = defineStore('prompt', () => {
  // 系统提示词
  const systemPrompt = ref<string>('')

  // 对话消息列表
  const messages = ref<ChatMessage[]>([])

  // 变量列表
  const variables = ref<Variable[]>([])

  // 当前输出（流式）
  const currentOutput = ref<string>('')

  // 是否正在运行
  const isRunning = ref<boolean>(false)

  // 运行历史
  const runHistory = ref<RunResult[]>([])

  // 最新运行结果
  const latestResult = computed(() => {
    return runHistory.value.length > 0
      ? runHistory.value[runHistory.value.length - 1]
      : null
  })

  // 添加用户消息
  function addUserMessage(content: string = '', attachments: MessageAttachment[] = []) {
    messages.value.push({
      id: nanoid(),
      role: 'user',
      content,
      attachments
    })
  }

  // 添加助手消息
  function addAssistantMessage(content: string = '') {
    messages.value.push({
      id: nanoid(),
      role: 'assistant',
      content
    })
  }

  // 更新消息
  function updateMessage(id: string, content: string) {
    const msg = messages.value.find(m => m.id === id)
    if (msg) {
      msg.content = content
    }
  }

  // 删除消息
  function deleteMessage(id: string) {
    const index = messages.value.findIndex(m => m.id === id)
    if (index >= 0) {
      messages.value.splice(index, 1)
    }
  }

  // 从某条消息开始重新生成（删除该消息及之后的所有消息）
  function regenerateFrom(id: string) {
    const index = messages.value.findIndex(m => m.id === id)
    if (index >= 0) {
      messages.value.splice(index)
    }
  }

  // 设置系统提示词
  function setSystemPrompt(prompt: string) {
    systemPrompt.value = prompt
  }

  // 添加变量
  function addVariable(name: string = '', value: string = '') {
    variables.value.push({ name, value })
  }

  // 更新变量
  function updateVariable(index: number, name: string, value: string) {
    if (index >= 0 && index < variables.value.length) {
      variables.value[index] = { name, value }
    }
  }

  // 删除变量
  function deleteVariable(index: number) {
    if (index >= 0 && index < variables.value.length) {
      variables.value.splice(index, 1)
    }
  }

  // 应用变量到内容
  function applyVariables(content: string): string {
    return applyTemplateVariables(content, variables.value)
  }

  // 获取构建好的消息列表（应用变量后）
  function getBuiltMessages(): ChatMessage[] {
    const result: ChatMessage[] = []

    // 添加系统消息
    if (systemPrompt.value.trim()) {
      result.push({
        id: 'system',
        role: 'system',
        content: applyVariables(systemPrompt.value)
      })
    }

    // 添加对话消息
    for (const msg of messages.value) {
      result.push({
        ...msg,
        content: applyVariables(msg.content)
      })
    }

    return result
  }

  // 设置运行状态
  function setRunning(running: boolean) {
    isRunning.value = running
    if (running) {
      currentOutput.value = ''
    }
  }

  // 追加输出内容（流式）
  function appendOutput(content: string) {
    currentOutput.value += content
  }

  // 添加运行结果
  function addRunResult(result: RunResult) {
    runHistory.value.push(result)
    // 将输出添加到消息列表
    addAssistantMessage(result.output)
  }

  // 清空对话
  function clearMessages() {
    messages.value = []
    currentOutput.value = ''
  }

  // 重置所有
  function resetAll() {
    systemPrompt.value = ''
    messages.value = []
    variables.value = []
    currentOutput.value = ''
    runHistory.value = []
  }

  return {
    systemPrompt,
    messages,
    variables,
    currentOutput,
    isRunning,
    runHistory,
    latestResult,
    addUserMessage,
    addAssistantMessage,
    updateMessage,
    deleteMessage,
    regenerateFrom,
    setSystemPrompt,
    addVariable,
    updateVariable,
    deleteVariable,
    applyVariables,
    getBuiltMessages,
    setRunning,
    appendOutput,
    addRunResult,
    clearMessages,
    resetAll
  }
})
