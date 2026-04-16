import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:Syanodb_2026@localhost:5432/tlink'
});

async function run() {
  await client.connect();
  await client.query(`
    ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS redirect_timeout bigint DEFAULT 3;
  `);
  console.log('Success');
  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
