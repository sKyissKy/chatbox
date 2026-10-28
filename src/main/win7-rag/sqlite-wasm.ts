import fs from 'node:fs'
import path from 'node:path'

type SqlValue = string | number | null | Uint8Array | boolean
type SqlArgs = SqlValue[] | Record<string, SqlValue>
type SqlStatement = string | { sql: string; args?: SqlArgs }

type SqlJsDatabase = {
  prepare(sql: string): SqlJsStatement
  run(sql: string, params?: SqlArgs): void
  export(): Uint8Array
  getRowsModified(): number
}

type SqlJsStatement = {
  bind(params?: SqlArgs): void
  step(): boolean
  getAsObject(): Record<string, unknown>
  free(): void
}

type InitSqlJs = (config: { locateFile: (file: string) => string }) => Promise<{
  Database: new (data?: Uint8Array) => SqlJsDatabase
}>

let initPromise: Promise<{ Database: new (data?: Uint8Array) => SqlJsDatabase }> | undefined

function getWasmPath(): string {
  if (typeof process.resourcesPath === 'string') {
    const packagedPath = path.join(process.resourcesPath, 'sql-wasm.wasm')
    if (fs.existsSync(packagedPath)) return packagedPath
    const unpackedWasm = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm'
    )
    if (fs.existsSync(unpackedWasm)) return unpackedWasm
  }
  try {
    const sqlJsEntry = require.resolve('sql.js')
    const sqlJsWasm = path.join(path.dirname(sqlJsEntry), 'sql-wasm.wasm')
    if (fs.existsSync(sqlJsWasm)) return sqlJsWasm
  } catch {}
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, 'sql-wasm.wasm'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
}

async function loadSqlJs(): Promise<{ Database: new (data?: Uint8Array) => SqlJsDatabase }> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const wasmPath = getWasmPath()
    let wasmBinary: Uint8Array | undefined
    try {
      if (fs.existsSync(wasmPath)) {
        wasmBinary = new Uint8Array(fs.readFileSync(wasmPath))
      }
    } catch (e) {
      console.error('[WasmSqlJs] Failed to read wasm file:', wasmPath, e)
    }

    let rawSqlJs: any
    const candidateModules = [
      'sql.js',
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'sql.js'),
      path.join(process.resourcesPath || '', 'node_modules', 'sql.js'),
      path.join(process.resourcesPath || '', 'sql.js'),
    ]
    for (const candidate of candidateModules) {
      try {
        rawSqlJs = require(candidate)
        if (rawSqlJs) break
      } catch {}
    }
    if (!rawSqlJs) {
      rawSqlJs = typeof require !== 'undefined' ? require('sql.js') : await import('sql.js')
    }
    const initSqlJs = (typeof rawSqlJs === 'function' ? rawSqlJs : rawSqlJs.default) as unknown as InitSqlJs
    return await initSqlJs({
      locateFile: () => wasmPath,
      ...(wasmBinary ? { wasmBinary } : {}),
    } as any)
  })()
  return await initPromise
}

function normalizeArgs(args?: SqlArgs): SqlArgs | undefined {
  if (!args || Array.isArray(args)) return args
  return Object.fromEntries(Object.entries(args).map(([key, value]) => [key.replace(/^[:@$]/u, ''), value]))
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(identifier)) throw new Error(`Invalid SQLite identifier: ${identifier}`)
  return `"${identifier}"`
}

export class WasmSqlJsClient {
  private constructor(
    private readonly filePath: string,
    private readonly database: SqlJsDatabase
  ) {}

  static async open(filePath: string): Promise<WasmSqlJsClient> {
    const sqlJs = await loadSqlJs()
    const data = fs.existsSync(filePath) ? new Uint8Array(fs.readFileSync(filePath)) : undefined
    return new WasmSqlJsClient(filePath, new sqlJs.Database(data))
  }

  async execute(statement: SqlStatement, positionalArgs?: SqlArgs): Promise<{
    columns: string[]
    rows: Record<string, unknown>[]
    rowsAffected: number
    lastInsertRowid?: number
  }> {
    const sql = typeof statement === 'string' ? statement : statement.sql
    const args = normalizeArgs(typeof statement === 'string' ? positionalArgs : statement.args)
    const prepared = this.database.prepare(sql)
    try {
      prepared.bind(args)
      const rows: Record<string, unknown>[] = []
      while (prepared.step()) rows.push(prepared.getAsObject())
      const result = {
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
        rowsAffected: this.database.getRowsModified(),
        lastInsertRowid: undefined as number | undefined,
      }
      if (/\b(insert|replace)\b/iu.test(sql)) {
        const id = this.database.prepare('SELECT last_insert_rowid() AS id')
        try {
          if (id.step()) result.lastInsertRowid = Number(id.getAsObject().id)
        } finally {
          id.free()
        }
      }
      this.persist()
      return result
    } finally {
      prepared.free()
    }
  }

  async batch(statements: SqlStatement[]): Promise<Array<Awaited<ReturnType<WasmSqlJsClient['execute']>>> > {
    const results = [] as Array<Awaited<ReturnType<WasmSqlJsClient['execute']>>>
    for (const statement of statements) results.push(await this.execute(statement))
    return results
  }

  async close(): Promise<void> {
    this.persist()
  }

  persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, this.database.export() as unknown as NodeJS.ArrayBufferView)
  }

  identifier(name: string): string {
    return quoteIdentifier(name)
  }
}

type VectorMetadata = Record<string, unknown>

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    dot += left[index] * right[index]
    leftNorm += left[index] ** 2
    rightNorm += right[index] ** 2
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0
}

export class WasmVectorStore {
  constructor(readonly turso: WasmSqlJsClient) {}

  async createIndex(params: { indexName: string; dimension: number }): Promise<void> {
    const table = this.turso.identifier(params.indexName)
    await this.turso.execute(
      `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, vector TEXT NOT NULL, metadata TEXT NOT NULL)`
    )
  }

  async upsert(params: { indexName: string; ids: string[]; vectors: number[][]; metadata: VectorMetadata[] }): Promise<void> {
    const table = this.turso.identifier(params.indexName)
    for (let index = 0; index < params.ids.length; index++) {
      await this.turso.execute({
        sql: `INSERT OR REPLACE INTO ${table} (id, vector, metadata) VALUES (?, ?, ?)`,
        args: [params.ids[index], JSON.stringify(params.vectors[index]), JSON.stringify(params.metadata[index])],
      })
    }
  }

  async query(params: { indexName: string; queryVector: number[]; topK: number }): Promise<Array<{ id: string; score: number; metadata: VectorMetadata }>> {
    const table = this.turso.identifier(params.indexName)
    const result = await this.turso.execute(`SELECT id, vector, metadata FROM ${table}`)
    return result.rows
      .map((row) => ({
        id: String(row.id),
        score: cosineSimilarity(params.queryVector, JSON.parse(String(row.vector)) as number[]),
        metadata: JSON.parse(String(row.metadata)) as VectorMetadata,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, params.topK)
  }

  async deleteIndex(params: { indexName: string }): Promise<void> {
    await this.turso.execute(`DROP TABLE IF EXISTS ${this.turso.identifier(params.indexName)}`)
  }

  async listIndexes(): Promise<string[]> {
    const result = await this.turso.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    return result.rows.map((row) => String(row.name))
  }

  async deleteVector(params: { indexName: string; id: string }): Promise<void> {
    await this.turso.execute({
      sql: `DELETE FROM ${this.turso.identifier(params.indexName)} WHERE id = ?`,
      args: [params.id],
    })
  }
}

export async function openWasmVectorStore(filePath: string): Promise<WasmVectorStore> {
  return new WasmVectorStore(await WasmSqlJsClient.open(filePath))
}
