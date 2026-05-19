import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
})

let initPromise: Promise<void> | null = null

export async function getDb(): Promise<Pool> {
  if (!initPromise) {
    initPromise = initSchema().catch(e => {
      initPromise = null
      throw e
    })
  }
  await initPromise
  return pool
}

export async function query(sql: string, params?: unknown[]) {
  const db = await getDb()
  return db.query(sql, params as unknown[])
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = await getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

async function initSchema() {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(987654321)')
    await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      "sourceFileName" TEXT NOT NULL DEFAULT '',
      "sourceTransactionId" TEXT,
      "transactionDate" TEXT NOT NULL,
      "completedDate" TEXT,
      description TEXT NOT NULL DEFAULT '',
      counterparty TEXT,
      merchant TEXT,
      amount FLOAT8 NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      fees FLOAT8 NOT NULL DEFAULT 0,
      "balanceAfterTransaction" FLOAT8,
      "transactionType" TEXT,
      "productOrAccount" TEXT,
      status TEXT,
      direction TEXT NOT NULL DEFAULT 'expense',
      "listName" TEXT,
      "groupName" TEXT,
      "isRecurring" BOOLEAN NOT NULL DEFAULT FALSE,
      "recurringType" TEXT NOT NULL DEFAULT 'one_time',
      "recurringEndType" TEXT,
      "recurringEndDate" TEXT,
      notes TEXT,
      "isSplit" BOOLEAN NOT NULL DEFAULT FALSE,
      "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "rawData" TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions("transactionDate");
    CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);
    CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);
    CREATE INDEX IF NOT EXISTS idx_transactions_list ON transactions("listName");
    CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions("isDeleted");

    CREATE TABLE IF NOT EXISTS transaction_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_groups (
      id TEXT PRIMARY KEY,
      "listId" TEXT NOT NULL,
      "listName" TEXT NOT NULL,
      name TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("listId") REFERENCES transaction_lists(id) ON DELETE CASCADE,
      UNIQUE("listName", name)
    );

    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY,
      "matchType" TEXT NOT NULL,
      "matchValue" TEXT NOT NULL,
      "listName" TEXT,
      "groupName" TEXT,
      "isRecurring" BOOLEAN NOT NULL DEFAULT FALSE,
      "recurringType" TEXT NOT NULL DEFAULT 'one_time',
      "recurringEndType" TEXT,
      "recurringEndDate" TEXT,
      "applyToFutureImports" BOOLEAN NOT NULL DEFAULT TRUE,
      priority INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      "fileName" TEXT NOT NULL,
      source TEXT NOT NULL,
      "importedAt" TEXT NOT NULL,
      "transactionCount" INTEGER NOT NULL DEFAULT 0,
      "duplicateCount" INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transaction_splits (
      id TEXT PRIMARY KEY,
      "transactionId" TEXT NOT NULL,
      "listName" TEXT,
      "groupName" TEXT,
      amount FLOAT8 NOT NULL,
      note TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("transactionId") REFERENCES transactions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_splits_tx ON transaction_splits("transactionId");

    CREATE TABLE IF NOT EXISTS budget_goals (
      id TEXT PRIMARY KEY,
      "listName" TEXT NOT NULL,
      "groupName" TEXT NOT NULL DEFAULT '',
      month TEXT NOT NULL DEFAULT '',
      "goalAmount" FLOAT8 NOT NULL,
      direction TEXT NOT NULL DEFAULT 'expense',
      period TEXT NOT NULL DEFAULT 'month',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      UNIQUE("listName", "groupName", month)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Suggestie',
      section TEXT NOT NULL DEFAULT 'Andere',
      status TEXT NOT NULL DEFAULT 'Nieuw',
      created_by TEXT NOT NULL DEFAULT 'Gebruiker',
      page TEXT,
      admin_reply TEXT,
      unread_by_admin BOOLEAN NOT NULL DEFAULT TRUE,
      unread_by_user BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_replies (
      id TEXT PRIMARY KEY,
      feedback_id TEXT NOT NULL,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS faq_items (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      source_feedback_id TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      iban TEXT,
      bank TEXT,
      type TEXT NOT NULL DEFAULT 'shared',
      color TEXT NOT NULL DEFAULT '#3b82f6',
      currency TEXT NOT NULL DEFAULT 'EUR',
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_members (
      "accountId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "isOwner" BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY ("accountId", "userId"),
      FOREIGN KEY ("accountId") REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
    );

    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "accountId" TEXT REFERENCES accounts(id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions("accountId");

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
    await seedDefaultLists(client)
    await client.query('SELECT pg_advisory_unlock(987654321)')
  } finally {
    client.release()
  }
}

async function seedDefaultLists(client: import('pg').PoolClient) {
  const result = await client.query('SELECT COUNT(*) as count FROM transaction_lists')
  if (parseInt(result.rows[0].count) > 0) return

  const now = new Date().toISOString()
  const lists = [
    { id: 'list-verloning', name: 'Verloning', color: '#22c55e', sortOrder: 0 },
    { id: 'list-wonen', name: 'Wonen', color: '#3b82f6', sortOrder: 1 },
    { id: 'list-voeding', name: 'Voeding', color: '#f59e0b', sortOrder: 2 },
    { id: 'list-transport', name: 'Transport', color: '#8b5cf6', sortOrder: 3 },
    { id: 'list-gezondheid', name: 'Gezondheid', color: '#ec4899', sortOrder: 4 },
    { id: 'list-kinderen', name: 'Kinderen', color: '#06b6d4', sortOrder: 5 },
    { id: 'list-vrije-tijd', name: 'Vrije tijd', color: '#f97316', sortOrder: 6 },
    { id: 'list-kleding', name: 'Kleding', color: '#84cc16', sortOrder: 7 },
    { id: 'list-sparen', name: 'Sparen & investeren', color: '#14b8a6', sortOrder: 8 },
    { id: 'list-abonnementen', name: 'Abonnementen', color: '#6366f1', sortOrder: 9 },
    { id: 'list-overige', name: 'Overige', color: '#94a3b8', sortOrder: 10 },
  ]

  const groups = [
    { id: 'g-loon-matthias', listId: 'list-verloning', listName: 'Verloning', name: 'Loon Matthias', sortOrder: 0 },
    { id: 'g-loon-krystle', listId: 'list-verloning', listName: 'Verloning', name: 'Loon Krystle', sortOrder: 1 },
    { id: 'g-premie-matthias', listId: 'list-verloning', listName: 'Verloning', name: 'Eindejaarspremie Matthias', sortOrder: 2 },
    { id: 'g-premie-krystle', listId: 'list-verloning', listName: 'Verloning', name: 'Eindejaarspremie Krystle', sortOrder: 3 },
    { id: 'g-hypotheek', listId: 'list-wonen', listName: 'Wonen', name: 'Hypotheek / Huur', sortOrder: 0 },
    { id: 'g-energie', listId: 'list-wonen', listName: 'Wonen', name: 'Energie', sortOrder: 1 },
    { id: 'g-verzekering', listId: 'list-wonen', listName: 'Wonen', name: 'Verzekering', sortOrder: 2 },
    { id: 'g-onderhoud', listId: 'list-wonen', listName: 'Wonen', name: 'Onderhoud & verbouwing', sortOrder: 3 },
    { id: 'g-supermarkt', listId: 'list-voeding', listName: 'Voeding', name: 'Supermarkt', sortOrder: 0 },
    { id: 'g-restaurant', listId: 'list-voeding', listName: 'Voeding', name: 'Restaurant & takeaway', sortOrder: 1 },
    { id: 'g-auto', listId: 'list-transport', listName: 'Transport', name: 'Auto (brandstof, onderhoud)', sortOrder: 0 },
    { id: 'g-openbaar', listId: 'list-transport', listName: 'Transport', name: 'Openbaar vervoer', sortOrder: 1 },
    { id: 'g-dokter', listId: 'list-gezondheid', listName: 'Gezondheid', name: 'Dokter & ziekenhuis', sortOrder: 0 },
    { id: 'g-apotheek', listId: 'list-gezondheid', listName: 'Gezondheid', name: 'Apotheek', sortOrder: 1 },
    { id: 'g-school', listId: 'list-kinderen', listName: 'Kinderen', name: 'School & activiteiten', sortOrder: 0 },
    { id: 'g-speelgoed', listId: 'list-kinderen', listName: 'Kinderen', name: 'Speelgoed & kleding', sortOrder: 1 },
    { id: 'g-vakantie', listId: 'list-vrije-tijd', listName: 'Vrije tijd', name: 'Vakantie & reizen', sortOrder: 0 },
    { id: 'g-sport', listId: 'list-vrije-tijd', listName: 'Vrije tijd', name: 'Sport & hobby', sortOrder: 1 },
    { id: 'g-gsm', listId: 'list-abonnementen', listName: 'Abonnementen', name: 'GSM & internet', sortOrder: 0 },
    { id: 'g-streaming', listId: 'list-abonnementen', listName: 'Abonnementen', name: 'Streaming & media', sortOrder: 1 },
  ]

  for (const l of lists) {
    await client.query(
      `INSERT INTO transaction_lists (id, name, color, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [l.id, l.name, l.color, l.sortOrder, now, now]
    )
  }
  for (const g of groups) {
    await client.query(
      `INSERT INTO transaction_groups (id, "listId", "listName", name, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [g.id, g.listId, g.listName, g.name, g.sortOrder, now, now]
    )
  }
}
