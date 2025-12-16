import type { MetaPromptTemplate } from './types'

export const DEFAULT_INITIAL_TEMPLATE: MetaPromptTemplate = {
  id: 'default-init',
  name: 'Default Initialization (Paper)',
  description: 'Standard initialization template from the Dual-Phase APO paper.',
  type: 'initial',
  content: `你是一位专业的提示词工程师。请为大型语言模型（LLM）编写一个高质量的中文提示词，以执行以下示例演示的任务。

提示词应包含：
1. 清晰定义任务类型并提供详细的任务描述。
2. 定义输出格式和约束条件。
3. 提供有关推理过程的见解和专业提示。
4. 确保生成的提示词完全使用中文。

同时，请根据任务特点，推荐一套最佳的模型参数配置（例如 temperature, topP, maxTokens 等）。

以下是输入-输出示例：
{{examples}}

请以 JSON 格式返回，格式如下：
{
  "prompt": "生成的提示词内容...",
  "params": {
    "temperature": 0.7,
    "topP": 1.0,
    "maxTokens": 2048
  }
}

注意：仅返回 JSON 字符串，不要包含 Markdown 代码块标记。`
}

export const DEFAULT_OPTIMIZATION_TEMPLATE: MetaPromptTemplate = {
  id: 'default-opt',
  name: 'Default Optimization (Paper)',
  description: 'Standard optimization template from the Dual-Phase APO paper.',
  type: 'optimization',
  content: `我正在优化一个任务的提示词。
当前的提示词是：
"""
{{current_prompt}}
"""

然而，该提示词在以下案例中失败了（输入 -> 预期输出 vs 实际输出）：
{{failed_cases}}

我已经确定提示词中的以下句子可能是原因：
"""
{{target_sentence}}
"""

请重写这个特定的句子以更好地处理失败案例，同时保持成功案例的原始逻辑。
同时，如果需要，请建议调整模型参数（温度 temperature、Top P、最大Token数 maxTokens 等）以配合新的提示词。

{{previous_failed_attempts}}

请以 JSON 格式返回，格式如下：
{
  "revised_sentence": "修改后的句子内容...",
  "params": {
    "temperature": 0.7,
    "topP": 1.0,
    "maxTokens": 2048
  }
}

注意：仅返回 JSON 字符串，不要包含 Markdown 代码块标记（如 \`\`\`json）。`
}

export const META_PROMPTS = [DEFAULT_INITIAL_TEMPLATE, DEFAULT_OPTIMIZATION_TEMPLATE]
