import 'dotenv/config'
import pg from 'pg'

// One shared pool for the whole process — pg manages connection
// reuse internally, same reasoning as Prisma's single-client pattern
// this replaced.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// If the database restarts (or the network blips), pg reports it as an 'error' on idle
// connections. With no listener, Node treats that as fatal and the whole API stops.
// Log it instead; the pool opens fresh connections by itself on the next request.
pool.on('error', (err) => {
  console.error('Database connection problem (the server keeps running):', err.message)
})
