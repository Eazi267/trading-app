import 'dotenv/config'
import pg from 'pg'

// One shared pool for the whole process — pg manages connection
// reuse internally, same reasoning as Prisma's single-client pattern
// this replaced.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
