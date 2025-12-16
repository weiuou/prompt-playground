// 简单的 nanoid 实现
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function nanoid(size: number = 21): string {
  let id = ''
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  for (let i = 0; i < size; i++) {
    const index = (bytes[i] || 0) % alphabet.length
    id += alphabet[index]
  }
  return id
}
