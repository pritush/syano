import pg from 'pg'

const sql = `
DO $$ BEGIN
  ALTER TABLE "sender_ids" ADD COLUMN "is_default" boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
`

async function main() {
  const client = new pg.Client({
    connectionString: process.env.NUXT_DATABASE_URL
  })
  await client.connect()
  console.log('Running SQL Migration:\n', sql)
  try {
    await client.query(sql)
    console.log('Migration applied successfully!')
  } catch (err) {
    console.error('Error applying migration:', err)
  } finally {
    await client.end()
  }
}

main().catch(console.error)
