import type { Variable } from '@/types'

/**
 * 将内容中的变量占位符 {{variable}} 替换为实际值
 * @param content 原始内容
 * @param variables 变量列表
 * @returns 替换后的内容
 */
export function applyVariables(content: string, variables: Variable[]): string {
  if (!content) return ''
  
  let result = content
  for (const v of variables) {
    if (v.name) {
      // 使用全局替换，忽略大小写（可选，这里暂不忽略以保持精确匹配）
      // 转义变量名中的特殊字符，防止正则错误
      const escapedName = v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, 'g')
      result = result.replace(regex, v.value || '')
    }
  }
  return result
}

/**
 * 从内容中提取所有变量名
 * @param content 内容
 * @returns 变量名列表
 */
export function extractVariables(content: string): string[] {
  if (!content) return []
  const regex = /\{\{\s*([^}]+?)\s*\}\}/g
  const matches = [...content.matchAll(regex)]
  return matches.map(m => m[1] || '')
}
