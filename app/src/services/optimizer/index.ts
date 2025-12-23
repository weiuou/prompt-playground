import type { LLMClient } from '../llm/types'
import type { OptimizerConfig, Example, OptimizationResult, OptimizationLog } from './types'
import type { ModelParams } from '@/types'
import { applyVariables } from '@/utils/template'
import { DEFAULT_PARAMS } from '@/types'
import { nanoid } from '@/utils/nanoid'
import { Evaluator } from './evaluator'
import type { TestCase } from '@/stores/testCases'

export class PromptOptimizer {
  private client: LLMClient
  private config: OptimizerConfig
  private onProgress?: (result: OptimizationResult) => void
  private onLog?: (log: OptimizationLog) => void
  private evaluator = new Evaluator()

  constructor(client: LLMClient, config: OptimizerConfig) {
    this.client = client
    this.config = config
    this.evaluator.setClient(client, config.evalModelId || config.modelId)
  }

  public setProgressCallback(callback: (result: OptimizationResult) => void) {
    this.onProgress = callback
  }

  public setLogCallback(callback: (log: OptimizationLog) => void) {
    this.onLog = callback
  }

  private log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', details?: OptimizationLog['details']) {
    if (this.onLog) {
      this.onLog({
        step: 0, // Will be overridden or passed differently
        type,
        message,
        timestamp: Date.now(),
        details
      })
    }
    console.log(`[Optimizer] ${message}`)
  }

  // --- Helper to parse JSON from LLM output ---
  private parseJSON(text: string): any {
    try {
      // 尝试直接解析
      return JSON.parse(text)
    } catch (e) {
      // 尝试从 markdown 代码块中提取
      const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          return JSON.parse(match[1] || match[0])
        } catch (e2) {
          console.error('Failed to parse JSON from block:', e2)
        }
      }
      return null
    }
  }

  // --- Helper to format evaluation rule description ---
  private getEvaluationDescription(testCase: TestCase): string {
    if (!testCase.evaluation) return 'Match Expected Output exactly'
    
    const config = testCase.evaluation
    switch (config.type) {
      case 'rule':
        return `Rule Check: Output must ${config.ruleConfig?.operator.replace('_', ' ')} "${config.ruleConfig?.value}"`
      case 'ai_judge':
        return `AI Judge: Score based on rubric "${config.aiConfig?.rubric || 'General quality'}"`
      case 'code':
        return `Code Check: Custom JavaScript validation`
      case 'human':
        return `Human Review: ${config.humanConfig?.description || 'Manual check'}`
      default:
        return 'Unknown Rule'
    }
  }

  // --- Phase 1: Initialization / Single-Shot Refinement ---

  async refinePrompt(draftPrompt: string): Promise<string> {
    // ... (This method keeps using simple string output for now, or could be updated if needed)
    // For consistency with "Refine" button which expects string, we keep it simple or parse JSON if we updated the template.
    // The previous update to templates.ts affected META_PROMPTS, but refinePrompt uses a hardcoded template.
    // Let's keep refinePrompt simple for now as per user request history.
    
    this.log('Phase 1: Refining Prompt (Single-Shot)...')
    const content = `你是一位专业的提示词工程师。用户提供了以下草稿提示词：
"""
${draftPrompt}
"""

请重写并优化此提示词，使其更有效、清晰且结构化。
优化后的提示词应：
1. 清晰定义角色/人物。
2. 概述具体任务和步骤。
3. 指定输出格式和约束条件。
4. 保持草稿的原始意图。

请仅返回优化后的提示词内容，无需任何解释或 Markdown 格式。`

    try {
      const response = await this.client.chat({
        model: this.config.modelId,
        messages: [{ id: nanoid(), role: 'user', content }],
        params: { ...DEFAULT_PARAMS, temperature: 0.7, maxTokens: 2000 }
      })
      
      const prompt = response.content.trim()
      this.log('Prompt refined successfully.', 'success')
      return prompt
    } catch (error) {
      this.log(`Failed to refine prompt: ${error}`, 'error')
      throw error
    }
  }

  async generateInitialPrompt(examples: Example[]): Promise<{ prompt: string, params?: Partial<ModelParams> }> {
    this.log('Phase 1: Generating Initial Prompt...')
    
    // Format examples with rule descriptions
    const examplesStr = examples.map((e, i) => {
      const tc = e as unknown as TestCase
      const ruleDesc = this.getEvaluationDescription(tc)
      return `Example ${i + 1}:\nInput: ${e.input}\nReference Output: ${e.expectedOutput || '(None)'}\nRequirement: ${ruleDesc}`
    }).join('\n\n')
    
    const content = applyVariables(this.config.initialTemplate, [
      { name: 'examples', value: examplesStr }
    ])

    try {
      const response = await this.client.chat({
        model: this.config.modelId,
        messages: [{ id: nanoid(), role: 'user', content }],
        params: { ...DEFAULT_PARAMS, temperature: 0.7, maxTokens: 2000 }
      })
      
      const rawOutput = response.content.trim()
      const parsed = this.parseJSON(rawOutput)
      
      let prompt = rawOutput
      let params = undefined

      if (parsed && parsed.prompt) {
        prompt = parsed.prompt
        params = parsed.params
        this.log('Parsed prompt and parameters from JSON.', 'success')
      } else {
        this.log('Failed to parse JSON, using raw output as prompt.', 'warning')
      }

      this.log('Initial prompt generated successfully.', 'success')
      return { prompt, params }
    } catch (error) {
      this.log(`Failed to generate initial prompt: ${error}`, 'error')
      throw error
    }
  }

  // --- Phase 2: Optimization Loop ---

  async optimize(initialPrompt: string, initialParams: Partial<ModelParams> | undefined, trainSet: Example[], valSet: Example[]) {
    this.log('Phase 2: Starting Optimization Loop...')
    
    let currentPrompt = initialPrompt
    let currentParams = initialParams || {}
    let currentScore = await this.evaluate(currentPrompt, currentParams, valSet)
    let bestPrompt = currentPrompt
    let bestParams = currentParams
    let bestScore = currentScore
    
    // Initialize weights for sentences
    let sentences = this.splitSentences(currentPrompt)
    let weights = new Array(sentences.length).fill(1.0)
    
    // Track recently tried candidates that failed to improve score
    // to avoid repeating them. Format: "target_sentence -> revised_sentence"
    let recentFailures: string[] = []

    this.log(`Initial Score: ${currentScore.toFixed(2)}`)
    
    // Notify Initial State
    if (this.onProgress) {
        this.onProgress({
          step: 0,
          prompt: currentPrompt,
          params: currentParams,
          score: currentScore,
          logs: []
        })
    }

    for (let k = 1; k <= this.config.maxSteps; k++) {
      this.log(`Step ${k}/${this.config.maxSteps} processing...`)
      
      // 1. Expansion: Select sentence to edit
      const probabilities = this.calculateProbabilities(weights)
      const selectedIdx = this.sampleIndex(probabilities)
      const targetSentence = sentences[selectedIdx] || ''
      
      if (!targetSentence) {
        this.log('Empty sentence selected, skipping.', 'warning')
        continue
      }
      
      // Get failure cases from the *previous* iteration (or current evaluation)
      const failures = await this.getFailureCases(currentPrompt, currentParams, trainSet)
      if (failures.length === 0) {
        this.log('No failure cases found on training set. 100% Score Achieved. Stopping early.', 'success')
        break
      }
      
      const failuresStr = failures.slice(0, 3).map(f => {
         // Try to find the original test case to get rule description
         // Note: failures array only has input/expected/actual strings, 
         // but we can try to match input from trainSet.
         const originalCase = trainSet.find(t => t.input === f.input) as unknown as TestCase
         const ruleDesc = originalCase ? this.getEvaluationDescription(originalCase) : 'Unknown Rule'
         
         const reasonStr = f.reason ? `\nEvaluation Reason: ${f.reason}` : ''
         
         return `Input: ${f.input}\nReference: ${f.expectedOutput}\nActual Output: ${f.actualOutput}\nFailed Requirement: ${ruleDesc}${reasonStr}`
      }).join('\n---\n')

      // Prepare failed attempts context
      const failedAttemptsStr = recentFailures.length > 0 
        ? `\n\n注意：我之前尝试过以下修改，但效果不佳（或没有提升），请避免生成相同或类似的修改：\n${recentFailures.join('\n')}\n`
        : ''

      // Generate candidate sentence
      const variables = [
        { name: 'current_prompt', value: currentPrompt },
        { name: 'failed_cases', value: failuresStr },
        { name: 'target_sentence', value: targetSentence },
        { name: 'previous_failed_attempts', value: failedAttemptsStr }
      ]
      
      const promptContent = applyVariables(this.config.optimizationTemplate, variables)

      let candidateSentence = ''
      let candidateParams = currentParams

      try {
        const response = await this.client.chat({
        model: this.config.modelId,
        messages: [{ id: nanoid(), role: 'user', content: promptContent }],
        params: { ...DEFAULT_PARAMS, temperature: 0.7 }
      })
      const rawOutput = response.content.trim()
      
      this.log('LLM suggested revision.', 'info', {
          metaPrompt: promptContent,
          llmOutput: rawOutput,
          failures: failuresStr,
          variables: variables.reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {})
      })

      const parsed = this.parseJSON(rawOutput)

        if (parsed && parsed.revised_sentence) {
            candidateSentence = parsed.revised_sentence
            if (parsed.params) {
                // Merge new params
                candidateParams = { ...currentParams, ...parsed.params }
                this.log('Model suggested parameter updates.', 'info')
            }
        } else {
            candidateSentence = rawOutput
        }

      } catch (e) {
        this.log(`LLM Error during expansion: ${e}`, 'error')
        continue
      }

      // Construct candidate prompt
      const candidateSentences = [...sentences]
      candidateSentences[selectedIdx] = candidateSentence
      const candidatePrompt = candidateSentences.join(' ')
      
      // 2. Acceptance
      
      const newScore = await this.evaluate(candidatePrompt, candidateParams, valSet)
      
      // Accept if score improves OR stays the same (to allow exploration / traversing plateaus)
      if (newScore >= currentScore) {
        if (newScore > currentScore) {
             this.log(`Improvement! Score: ${currentScore.toFixed(2)} -> ${newScore.toFixed(2)}`, 'success')
             // Clear failures list on real improvement as we moved to a new better state
             recentFailures = []
        } else {
             this.log(`Score stable (${newScore.toFixed(2)}). Accepting change to explore.`, 'info')
             // Keep failures list, as we are technically on a similar level
        }

        currentPrompt = candidatePrompt
        currentParams = candidateParams
        currentScore = newScore
        sentences = candidateSentences
        
        // Update weights (Simplified EXP3-like)
        weights[selectedIdx] *= Math.exp(0.5) // Learning rate 0.5
        
        if (newScore > bestScore) {
          bestScore = newScore
          bestPrompt = currentPrompt
          bestParams = currentParams
        }
      } else {
        this.log(`No improvement. Score: ${newScore.toFixed(2)} (vs ${currentScore.toFixed(2)})`)
        // Record this failed attempt
        if (candidateSentence && candidateSentence !== targetSentence) {
             recentFailures.push(`Original: "${targetSentence}"\nFailed Revision: "${candidateSentence}"`)
             // Limit size of history
             if (recentFailures.length > 5) recentFailures.shift()
        }
      }

      // Notify Progress
      if (this.onProgress) {
        this.onProgress({
          step: k,
          prompt: currentPrompt,
          params: currentParams,
          variables: variables.reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {}),
          score: currentScore,
          logs: []
        })
      }
    }
    
    return { bestPrompt, bestParams, bestScore }
  }

  // --- Helpers ---

  private splitSentences(text: string): string[] {
    return text.match(/[^.!?。！？]+[.!?。！？]+(\s|$)/g)?.map(s => s.trim()) || [text]
  }

  private calculateProbabilities(weights: number[]): number[] {
    const expWeights = weights.map(w => Math.exp(w))
    const sum = expWeights.reduce((a, b) => a + b, 0)
    return expWeights.map(w => w / sum)
  }

  private sampleIndex(probs: number[]): number {
    const r = Math.random()
    let acc = 0
    for (let i = 0; i < probs.length; i++) {
      acc += probs[i]!
      if (r < acc) return i
    }
    return probs.length - 1
  }



  private async evaluate(prompt: string, params: Partial<ModelParams>, examples: Example[]): Promise<number> {
    let totalScore = 0
    const evalParams = { ...DEFAULT_PARAMS, ...params, temperature: 0 }
    
    for (const ex of examples) {
      try {
        const userMessage: any = { id: nanoid(), role: 'user', content: ex.input }
        if (ex.imageUrls && ex.imageUrls.length > 0) {
          userMessage.attachments = ex.imageUrls.map(url => ({
            id: nanoid(),
            type: 'image',
            content: url,
            name: 'test-case-image'
          }))
        }

        const res = await this.client.chat({
          model: this.config.evalModelId || this.config.modelId,
          messages: [
            { id: nanoid(), role: 'system', content: prompt },
            userMessage
          ],
          params: evalParams as any
        })
        
        // Cast Example to TestCase (assuming examples are TestCases in runtime)
        // Note: The optimizer store passes `testCases` as `examples`.
        // We should probably update the Example type to TestCase or use Intersection.
        // For now, let's assume `ex` has the evaluation property if it came from store.
        const testCase = ex as unknown as TestCase
        
        // If testCase doesn't have evaluation config (legacy or simple example), fallback to simple include
        if (!testCase.evaluation) {
             if (res.content.trim().includes(ex.expectedOutput.trim())) {
                totalScore++
             }
        } else {
            const result = await this.evaluator.evaluate(res.content.trim(), testCase)
            totalScore += result.score
        }

      } catch (e) {
        console.error('Eval error', e)
      }
    }
    return totalScore / examples.length
  }

  private async getFailureCases(prompt: string, params: Partial<ModelParams>, examples: Example[]): Promise<{input: string, expectedOutput: string, actualOutput: string, reason?: string}[]> {
    const failures = []
    const evalParams = { ...DEFAULT_PARAMS, ...params }

    for (const ex of examples) {
       try {
        const userMessage: any = { id: nanoid(), role: 'user', content: ex.input }
        if (ex.imageUrls && ex.imageUrls.length > 0) {
          userMessage.attachments = ex.imageUrls.map(url => ({
            id: nanoid(),
            type: 'image',
            content: url,
            name: 'test-case-image'
          }))
        }

        const res = await this.client.chat({
          model: this.config.evalModelId || this.config.modelId,
          messages: [
            { id: nanoid(), role: 'system', content: prompt },
            userMessage
          ],
          params: evalParams as any
        })
        const actual = res.content.trim()
        
        const testCase = ex as unknown as TestCase
        let passed = false
        let reason = ''
        
        if (!testCase.evaluation) {
             passed = actual.includes(ex.expectedOutput.trim())
        } else {
            const result = await this.evaluator.evaluate(actual, testCase)
            // 只要分数不是满分 1.0，就视为需要优化（即使 pass 为 true）
            // Only consider it passed if score is effectively 1.0
            if (result.score < 1) {
                passed = false
                // 如果本来是 pass (例如 >= 0.7)，但没满分，我们在理由里补充说明
                if (result.pass) {
                     reason = `[Pass with Partial Score: ${result.score.toFixed(1)}] ${result.reason || ''}`
                } else {
                     reason = result.reason || ''
                }
            } else {
                passed = true
                reason = result.reason || ''
            }
        }

        if (!passed) {
          failures.push({
            input: ex.input,
            expectedOutput: ex.expectedOutput,
            actualOutput: actual,
            reason
          })
        }
      } catch (e) {
        failures.push({ input: ex.input, expectedOutput: ex.expectedOutput, actualOutput: 'Error', reason: String(e) })
      }
    }
    return failures
  }
}
