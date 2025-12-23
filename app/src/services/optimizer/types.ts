import type { ModelParams } from '@/types'

export interface Example {
  input: string
  imageUrls?: string[]
  expectedOutput: string
}

export interface OptimizationLog {
  step: number
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  timestamp: number
  details?: {
    metaPrompt?: string
    llmOutput?: string
    failures?: string
    variables?: Record<string, string> // New: Capture template variables
  }
}

export interface OptimizationResult {
  step: number
  prompt: string
  params?: Partial<ModelParams>
  variables?: Record<string, string> // New
  score: number
  logs: OptimizationLog[]
}

export interface OptimizationHistoryItem {
  step: number
  prompt: string
  params?: Partial<ModelParams>
  score: number
}

export interface OptimizationState {
  isOptimizing: boolean
  currentStep: number
  currentPrompt: string
  currentParams?: Partial<ModelParams>
  currentVariables?: Record<string, string> // New: Real-time variables for UI
  bestPrompt: string
  bestParams?: Partial<ModelParams>
  bestScore: number
  logs: OptimizationLog[]
  history: OptimizationHistoryItem[]
}

export interface OptimizerConfig {
  maxSteps: number
  modelId: string // The model used for optimization (e.g. GPT-4)
  evalModelId: string // The model used for evaluation
  initialTemplate: string
  optimizationTemplate: string
  batchSize?: number // Number of examples to use in meta-prompt (optional)
}

export interface MetaPromptTemplate {
  id: string
  name: string
  description: string
  content: string
  type: 'initial' | 'optimization'
}
