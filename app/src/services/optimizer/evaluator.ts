import type { TestCase } from '@/stores/testCases'
import type { LLMClient } from '../llm/types'
import { nanoid } from '@/utils/nanoid'
import { DEFAULT_PARAMS } from '@/types'

export interface EvaluationResult {
  pass: boolean
  score: number // 0-1
  reason?: string
}

export class Evaluator {
  private client?: LLMClient
  private modelId?: string

  constructor(client?: LLMClient, modelId?: string) {
    this.client = client
    this.modelId = modelId
  }

  public setClient(client: LLMClient, modelId: string) {
    this.client = client
    this.modelId = modelId
  }

  /**
   * 评估单个用例
   */
  async evaluate(output: string, testCase: TestCase): Promise<EvaluationResult> {
    const config = testCase.evaluation
    
    switch (config.type) {
      case 'rule':
        return this.evaluateRule(output, testCase)
      case 'human':
        return this.evaluateHuman(output, testCase)
      case 'code':
        return this.evaluateCode(output, testCase)
      case 'ai_judge':
        return this.evaluateAI(output, testCase)
      default:
        return { pass: false, score: 0, reason: 'Unknown evaluation type' }
    }
  }

  // ... (evaluateRule and evaluateHuman are same as before)

  /**
   * 2. 代码执行评估 (简单的 new Function 沙箱)
   * 警告：这在本地运行是危险的，但在 Playground 环境中，我们假设用户运行的是自己的 Checker。
   * 理想情况下应该使用 Worker 或 iframe 沙箱。
   */
  private evaluateCode(output: string, testCase: TestCase): EvaluationResult {
    const config = testCase.evaluation.codeConfig
    if (!config || !config.code) {
      return { pass: false, score: 0, reason: 'Missing checker code' }
    }

    try {
      // 构造 Checker 函数
      // 函数签名: (output, expected) => boolean | { pass: boolean, score: number, reason: string }
      const checker = new Function('output', 'expected', config.code)
      
      const result = checker(output, testCase.expectedOutput)
      
      if (typeof result === 'boolean') {
        return {
          pass: result,
          score: result ? 1 : 0,
          reason: result ? 'Checker passed' : 'Checker failed'
        }
      } else if (typeof result === 'object') {
        return {
          pass: !!result.pass,
          score: typeof result.score === 'number' ? result.score : (result.pass ? 1 : 0),
          reason: result.reason || (result.pass ? 'Checker passed' : 'Checker failed')
        }
      } else {
        return { pass: false, score: 0, reason: 'Checker returned invalid type' }
      }
    } catch (e) {
      return { pass: false, score: 0, reason: `Checker Execution Error: ${e}` }
    }
  }

  /**
   * 3. AI 裁判评估
   */
  private async evaluateAI(output: string, testCase: TestCase): Promise<EvaluationResult> {
    const config = testCase.evaluation.aiConfig
    if (!this.client || !this.modelId) {
      return { pass: false, score: 0, reason: 'LLM Client not initialized for AI Judge' }
    }

    // 强制的 JSON 格式说明
    const JSON_FORMAT_INSTRUCTION = `
请以 JSON 格式返回结果（不要使用 Markdown 代码块，直接返回 JSON 字符串），格式如下：
{
  "score": 0, // 0-10 分，可以是小数
  "reason": "详细的评分理由，指出优点和不足",
  "pass": true // 如果分数 >= 7 则为 true，否则为 false
}`

    let prompt = ''

    // 如果用户提供了自定义 Prompt，则使用用户的，但强制追加格式要求
    if (config?.prompt) {
        // 支持简单的变量替换
        prompt = config.prompt
            .replace('{{input}}', testCase.input)
            .replace('{{expected}}', testCase.expectedOutput || '')
            .replace('{{output}}', output)
            .replace('{{rubric}}', config.rubric || '')
        
        // 追加格式要求，确保系统能解析
        prompt += `\n\n${JSON_FORMAT_INSTRUCTION}`
    } else {
        // 默认的裁判 Prompt
        prompt = `你是一位公正的 AI 裁判。请根据以下信息对 AI 生成的回复进行评分。

[输入/任务]
${testCase.input}

[预期结果/参考]
${testCase.expectedOutput || '(无)'}

[实际生成回复]
${output}

[评分标准]
${config?.rubric || '请评估实际回复是否正确回答了输入的问题，且符合预期结果的要求（如果有）。'}

请仔细评估实际回复是否符合评分标准。
请给出 0 到 10 分的分数（10分为满分），并提供详细的理由。
如果分数未达到满分，请具体说明扣分点以及实际回复与预期之间的差距。

${JSON_FORMAT_INSTRUCTION}`
    }

    try {
        const res = await this.client.chat({
            model: config?.model || this.modelId, // 使用指定的模型或默认模型
            messages: [{ id: nanoid(), role: 'user', content: prompt }],
            params: { ...DEFAULT_PARAMS, temperature: 0 } // 裁判应尽可能客观确定
        })

        const content = res.content.trim()
        
        // 解析 JSON
        let result: any = {}
        try {
            // 尝试提取 JSON 块
            const match = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
            if (match) {
                result = JSON.parse(match[1] || match[0])
            } else {
                result = JSON.parse(content)
            }
        } catch (e) {
            // 如果解析失败，尝试简单的正则提取分数
            const scoreMatch = content.match(/score"?:\s*(\d+)/i)
            if (scoreMatch && scoreMatch[1]) {
                const s = parseInt(scoreMatch[1], 10)
                return {
                    pass: s >= 7,
                    score: s / 10,
                    reason: content.slice(0, 100) + '...' // 截取部分作为理由
                }
            }
            return { pass: false, score: 0, reason: `Failed to parse Judge output: ${content}` }
        }

        return {
            pass: !!result.pass,
            score: (typeof result.score === 'number' ? result.score : 0) / 10, // 归一化到 0-1
            reason: result.reason || 'AI Judge decision'
        }

    } catch (e) {
        return { pass: false, score: 0, reason: `AI Judge Error: ${e}` }
    }
  }

  /**
   * 1. 规则式评估
   */
  private evaluateRule(output: string, testCase: TestCase): EvaluationResult {
    const config = testCase.evaluation.ruleConfig
    if (!config) {
      return { pass: false, score: 0, reason: 'Missing rule configuration' }
    }

    const { operator, value } = config
    const target = value.trim()
    const content = output.trim()

    let pass = false
    let reason = ''

    switch (operator) {
      case 'contains':
        pass = content.includes(target)
        reason = pass ? 'Output contains expected string' : `Output does not contain "${target}"`
        break
      
      case 'not_contains':
        pass = !content.includes(target)
        reason = pass ? 'Output does not contain forbidden string' : `Output contains forbidden "${target}"`
        break
      
      case 'equals':
        pass = content === target
        reason = pass ? 'Output matches exactly' : 'Output does not match exactly'
        break
      
      case 'regex':
        try {
          const regex = new RegExp(target, 'i') // 默认忽略大小写？或者让用户指定 flag
          pass = regex.test(content)
          reason = pass ? 'Regex matched' : `Regex "${target}" did not match`
        } catch (e) {
          return { pass: false, score: 0, reason: `Invalid Regex: ${e}` }
        }
        break
        
      default:
        return { pass: false, score: 0, reason: `Unknown operator: ${operator}` }
    }

    return {
      pass,
      score: pass ? 1 : 0,
      reason
    }
  }

  /**
   * 4. 人工评估 (模拟)
   * 在自动化流程中，默认视作通过（或者忽略），因为无法实时打分。
   * 如果是 "Human-in-the-loop" 模式，这里应该抛出信号暂停。
   * 目前简化处理：如果在自动化 Loop 中，我们暂时标记为 Skip (Score 0) 或 Pass (Score 1)？
   * 为了不阻碍优化，我们暂时返回 Pass，但标记 Reason 为 "Human eval skipped in auto mode"。
   * 或者，更严谨的做法是：优化器应该过滤掉 Human 类型的 Case，只跑自动化的 Case。
   */
  private evaluateHuman(_output: string, _testCase: TestCase): EvaluationResult {
    // 实际场景下，Human Eval 不会在这里自动执行。
    // 这里返回一个占位结果。
    return {
      pass: true,
      score: 1, // 暂时给满分，以免拉低平均分
      reason: 'Human evaluation required (Skipped in auto-mode)'
    }
  }
}
