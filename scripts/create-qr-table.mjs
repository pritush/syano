import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:Syanodb_2026@localhost:5432/tlink'
});

async function run() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS qr_scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      link_id varchar(64) REFERENCES links(id) ON DELETE set null,
      slug varchar(128),
      created_at timestamp with time zone DEFAULT now()
    )
  `);
  console.log('Success');
  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
