import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from 'nanoid'

export type EvaluationType = 'rule' | 'code' | 'ai_judge' | 'human'

export interface EvaluationConfig {
  type: EvaluationType
  
  // 1. 规则式评估 (Rule-Based)
  ruleConfig?: {
    operator: 'contains' | 'not_contains' | 'equals' | 'regex'
    value: string // 预期的字符串或正则表达式
  }

  // 2. 代码执行评估 (Code Execution / OJ Checker)
  codeConfig?: {
    language: 'javascript' // 目前仅支持 JS
    code: string // 函数体: (output, expected) => boolean
  }

  // 3. AI 裁判 (LLM-as-a-Judge)
  aiConfig?: {
    prompt: string // 自定义评分 Prompt
    model?: string // 可选指定评测模型
    rubric?: string // 评分标准描述
  }

  // 4. 人工评判 (Human)
  humanConfig?: {
    description: string // 提示人工注意看什么
  }
}

export interface TestCase {
  id: string
  name: string
  input: string
  imageUrls?: string[] // Base64 图片数据列表
  expectedOutput: string // 依然保留，作为 Rule 和 Code 的参考值
  tags: string[]
  evaluation: EvaluationConfig // 新增：评估配置
}

export const useTestCasesStore = defineStore('testCases', () => {
  const testCases = ref<TestCase[]>([
    { 
      id: '1', 
      name: '示例 1 (翻译)', 
      input: 'Translate to French: Hello', 
      expectedOutput: 'Bonjour', 
      tags: ['translation'],
      evaluation: {
        type: 'rule',
        ruleConfig: {
          operator: 'contains',
          value: 'Bonjour'
        }
      }
    },
    { 
      id: '2', 
      name: '示例 2 (翻译)', 
      input: 'Translate to French: World', 
      expectedOutput: 'Monde', 
      tags: ['translation'],
      evaluation: {
        type: 'rule',
        ruleConfig: {
          operator: 'contains',
          value: 'Monde'
        }
      }
    }
  ])

  function addTestCase(c: Partial<TestCase>) {
    testCases.value.push({
      id: nanoid(),
      name: c.name || 'New Case',
      input: c.input || '',
      imageUrls: c.imageUrls || [],
      expectedOutput: c.expectedOutput || '',
      tags: c.tags || [],
      evaluation: c.evaluation || {
        type: 'rule',
        ruleConfig: {
          operator: 'contains',
          value: ''
        }
      }
    })
  }

  function updateTestCase(id: string, c: Partial<TestCase>) {
    const index = testCases.value.findIndex(x => x.id === id)
    if (index !== -1) {
      testCases.value[index] = { ...testCases.value[index], ...c } as TestCase
    }
  }

  function removeTestCase(id: string) {
    testCases.value = testCases.value.filter(x => x.id !== id)
  }

  return {
    testCases,
    addTestCase,
    updateTestCase,
    removeTestCase
  }
}, {
  persist: true
})
