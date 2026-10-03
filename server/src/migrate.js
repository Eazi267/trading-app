import 'dotenv/config'
import { readdir, readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'
import { pool } from './db.js'

// Deliberately minimal — no down-migrations, no rollback tooling.
// This is meant to get a fresh Postgres instance (local dev, or a
// brand-new Railway plugin) to the current schema, applied once each,
// in filename order. Enough for where the project is right now; a
// real migration framework (node-pg-migrate, or Prisma once the
// binary-host issue isn't in the way) is worth adopting once schema
// changes get frequent enough that hand-tracking "did I run this
// already" stops being reliable.
const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql')

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(SQL_DIR)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file])
    if (rows.length) {
      console.log(`skip  ${file} (already applied)`)
      continue
    }
    const sql = await readFile(path.join(SQL_DIR, file), 'utf8')
    console.log(`apply ${file}`)
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      await pool.query('COMMIT')
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }
  }

  console.log('Migrations up to date.')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
