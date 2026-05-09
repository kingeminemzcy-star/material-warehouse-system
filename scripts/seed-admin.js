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
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const supabaseUserId = process.env.ADMIN_SUPABASE_USER_ID || "local-admin";
    await client.query(
      `insert into "UserProfile"
        ("id", "supabaseUserId", "name", "phone", "role", "isActive", "createdAt", "updatedAt")
       values ($1, $2, $3, null, 'ADMIN', true, now(), now())
       on conflict ("supabaseUserId") do update set
        "name" = excluded."name",
        "role" = excluded."role",
        "isActive" = true,
        "updatedAt" = now()`,
      [crypto.randomUUID(), supabaseUserId, "系统管理员"]
    );
    console.log(`admin profile ready: ${supabaseUserId}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
