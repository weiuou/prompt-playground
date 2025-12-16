import Dexie, { type EntityTable } from 'dexie'
import type { PromptSession, RunResult, TestCase, PromptVersion } from '@/types'

// 定义数据库
class PromptPlaygroundDB extends Dexie {
  sessions!: EntityTable<PromptSession, 'id'>
  runResults!: EntityTable<RunResult, 'id'>
  testCases!: EntityTable<TestCase, 'id'>
  versions!: EntityTable<PromptVersion, 'id'>

  constructor() {
    super('PromptPlaygroundDB')

    this.version(1).stores({
      sessions: 'id, name, createdAt, updatedAt',
      runResults: 'id, sessionId, timestamp',
      testCases: 'id, name, *tags',
      versions: 'id, sessionId, createdAt'
    })
  }
}

// 数据库实例
export const db = new PromptPlaygroundDB()

// Session 操作
export const sessionStorage = {
  async getAll(): Promise<PromptSession[]> {
    return db.sessions.orderBy('updatedAt').reverse().toArray()
  },

  async getById(id: string): Promise<PromptSession | undefined> {
    return db.sessions.get(id)
  },

  async save(session: PromptSession): Promise<void> {
    await db.sessions.put(session)
  },

  async delete(id: string): Promise<void> {
    await db.sessions.delete(id)
  }
}

// RunResult 操作
export const runResultStorage = {
  async getBySession(sessionId: string): Promise<RunResult[]> {
    return db.runResults
      .where('sessionId')
      .equals(sessionId)
      .reverse()
      .toArray()
  },

  async save(result: RunResult): Promise<void> {
    await db.runResults.put(result)
  },

  async delete(id: string): Promise<void> {
    await db.runResults.delete(id)
  },

  async deleteBySession(sessionId: string): Promise<void> {
    await db.runResults.where('sessionId').equals(sessionId).delete()
  }
}

// TestCase 操作
export const testCaseStorage = {
  async getAll(): Promise<TestCase[]> {
    return db.testCases.toArray()
  },

  async getById(id: string): Promise<TestCase | undefined> {
    return db.testCases.get(id)
  },

  async save(testCase: TestCase): Promise<void> {
    await db.testCases.put(testCase)
  },

  async saveMany(testCases: TestCase[]): Promise<void> {
    await db.testCases.bulkPut(testCases)
  },

  async delete(id: string): Promise<void> {
    await db.testCases.delete(id)
  },

  async clear(): Promise<void> {
    await db.testCases.clear()
  }
}

// Version 操作
export const versionStorage = {
  async getBySession(sessionId: string): Promise<PromptVersion[]> {
    return db.versions
      .where('sessionId')
      .equals(sessionId)
      .reverse()
      .toArray()
  },

  async save(version: PromptVersion): Promise<void> {
    await db.versions.put(version)
  },

  async delete(id: string): Promise<void> {
    await db.versions.delete(id)
  }
}

// 导出所有数据
export async function exportAllData() {
  const [sessions, runResults, testCases, versions] = await Promise.all([
    db.sessions.toArray(),
    db.runResults.toArray(),
    db.testCases.toArray(),
    db.versions.toArray()
  ])

  return {
    sessions,
    runResults,
    testCases,
    versions,
    exportedAt: Date.now()
  }
}

// 导入数据
export async function importData(data: {
  sessions?: PromptSession[]
  runResults?: RunResult[]
  testCases?: TestCase[]
  versions?: PromptVersion[]
}) {
  if (data.sessions) await db.sessions.bulkPut(data.sessions)
  if (data.runResults) await db.runResults.bulkPut(data.runResults)
  if (data.testCases) await db.testCases.bulkPut(data.testCases)
  if (data.versions) await db.versions.bulkPut(data.versions)
}
