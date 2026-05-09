const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

function readEnv() {
  const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const env = {};
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    env[trimmed.slice(0, index).trim()] = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
  return env;
}

async function main() {
  const env = readEnv();
  const migrationName = "20260509000000_init";
  const migrationPath = path.join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query("begin");
    await client.query(`
      create table if not exists "_prisma_migrations" (
        "id" varchar(36) primary key,
        "checksum" varchar(64) not null,
        "finished_at" timestamptz,
        "migration_name" varchar(255) not null,
        "logs" text,
        "rolled_back_at" timestamptz,
        "started_at" timestamptz not null default now(),
        "applied_steps_count" integer not null default 0
      )
    `);

    const existing = await client.query(
      'select "id" from "_prisma_migrations" where "migration_name" = $1',
      [migrationName]
    );

    if (existing.rowCount === 0) {
      await client.query(sql);
      await client.query(
        `insert into "_prisma_migrations"
          ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         values ($1, $2, now(), $3, null, null, now(), 1)`,
        [crypto.randomUUID(), checksum, migrationName]
      );
      console.log(`migration applied: ${migrationName}`);
    } else {
      console.log(`migration already recorded: ${migrationName}`);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
