import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '../data/budget.db')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sqlite = new Database(DB_PATH)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function createSchema(client) {
  console.log('Creating schema...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS transaction_lists (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transaction_groups (
      id TEXT PRIMARY KEY, "listId" TEXT NOT NULL, "listName" TEXT NOT NULL, name TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("listId") REFERENCES transaction_lists(id) ON DELETE CASCADE,
      UNIQUE("listName", name)
    );
    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY, "matchType" TEXT NOT NULL, "matchValue" TEXT NOT NULL,
      "listName" TEXT, "groupName" TEXT, "isRecurring" BOOLEAN NOT NULL DEFAULT FALSE,
      "recurringType" TEXT NOT NULL DEFAULT 'one_time', "recurringEndType" TEXT, "recurringEndDate" TEXT,
      "applyToFutureImports" BOOLEAN NOT NULL DEFAULT TRUE, priority INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY, "fileName" TEXT NOT NULL, source TEXT NOT NULL,
      "importedAt" TEXT NOT NULL, "transactionCount" INTEGER NOT NULL DEFAULT 0, "duplicateCount" INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, "sourceFileName" TEXT NOT NULL DEFAULT '',
      "sourceTransactionId" TEXT, "transactionDate" TEXT NOT NULL, "completedDate" TEXT,
      description TEXT NOT NULL DEFAULT '', counterparty TEXT, merchant TEXT,
      amount FLOAT8 NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', fees FLOAT8 NOT NULL DEFAULT 0,
      "balanceAfterTransaction" FLOAT8, "transactionType" TEXT, "productOrAccount" TEXT, status TEXT,
      direction TEXT NOT NULL DEFAULT 'expense', "listName" TEXT, "groupName" TEXT,
      "isRecurring" BOOLEAN NOT NULL DEFAULT FALSE, "recurringType" TEXT NOT NULL DEFAULT 'one_time',
      "recurringEndType" TEXT, "recurringEndDate" TEXT, notes TEXT,
      "isSplit" BOOLEAN NOT NULL DEFAULT FALSE, "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, "rawData" TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions("transactionDate");
    CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions("isDeleted");
    CREATE TABLE IF NOT EXISTS transaction_splits (
      id TEXT PRIMARY KEY, "transactionId" TEXT NOT NULL, "listName" TEXT, "groupName" TEXT,
      amount FLOAT8 NOT NULL, note TEXT, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("transactionId") REFERENCES transactions(id)
    );
    CREATE TABLE IF NOT EXISTS budget_goals (
      id TEXT PRIMARY KEY, "listName" TEXT NOT NULL, "groupName" TEXT NOT NULL DEFAULT '',
      month TEXT NOT NULL DEFAULT '', "goalAmount" FLOAT8 NOT NULL,
      direction TEXT NOT NULL DEFAULT 'expense', period TEXT NOT NULL DEFAULT 'month',
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL,
      UNIQUE("listName", "groupName", month)
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Suggestie', section TEXT NOT NULL DEFAULT 'Andere',
      status TEXT NOT NULL DEFAULT 'Nieuw', created_by TEXT NOT NULL DEFAULT 'Gebruiker',
      page TEXT, admin_reply TEXT, unread_by_admin BOOLEAN NOT NULL DEFAULT TRUE,
      unread_by_user BOOLEAN NOT NULL DEFAULT FALSE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback_replies (
      id TEXT PRIMARY KEY, feedback_id TEXT NOT NULL, author TEXT NOT NULL,
      message TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS faq_items (
      id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT TRUE, source_feedback_id TEXT,
      order_index INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `)
}

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Starting migration...\n')
    await createSchema(client)

    // --- transaction_lists ---
    const lists = sqlite.prepare('SELECT * FROM transaction_lists').all()
    console.log(`Migrating ${lists.length} lists...`)
    for (const r of lists) {
      await client.query(
        `INSERT INTO transaction_lists (id, name, color, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [r.id, r.name, r.color, r.sortOrder, r.createdAt, r.updatedAt]
      )
    }

    // --- transaction_groups ---
    const groups = sqlite.prepare('SELECT * FROM transaction_groups').all()
    console.log(`Migrating ${groups.length} groups...`)
    for (const r of groups) {
      await client.query(
        `INSERT INTO transaction_groups (id, "listId", "listName", name, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [r.id, r.listId, r.listName, r.name, r.sortOrder, r.createdAt, r.updatedAt]
      )
    }

    // --- classification_rules ---
    const rules = sqlite.prepare('SELECT * FROM classification_rules').all()
    console.log(`Migrating ${rules.length} classification rules...`)
    for (const r of rules) {
      await client.query(
        `INSERT INTO classification_rules (id, "matchType", "matchValue", "listName", "groupName", "isRecurring", "recurringType", "recurringEndType", "recurringEndDate", "applyToFutureImports", priority, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
        [r.id, r.matchType, r.matchValue, r.listName, r.groupName, !!r.isRecurring, r.recurringType, r.recurringEndType, r.recurringEndDate, !!r.applyToFutureImports, r.priority, r.createdAt, r.updatedAt]
      )
    }

    // --- transactions (in batches) ---
    const transactions = sqlite.prepare('SELECT * FROM transactions').all()
    console.log(`Migrating ${transactions.length} transactions...`)
    let txCount = 0
    for (const r of transactions) {
      await client.query(
        `INSERT INTO transactions (
          id, source, "sourceFileName", "sourceTransactionId",
          "transactionDate", "completedDate", description, counterparty, merchant,
          amount, currency, fees, "balanceAfterTransaction",
          "transactionType", "productOrAccount", status, direction,
          "listName", "groupName", "isRecurring", "recurringType",
          "recurringEndType", "recurringEndDate", notes, "isSplit", "isDeleted",
          "createdAt", "updatedAt", "rawData"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
        ON CONFLICT DO NOTHING`,
        [
          r.id, r.source, r.sourceFileName, r.sourceTransactionId,
          r.transactionDate, r.completedDate, r.description, r.counterparty, r.merchant,
          r.amount, r.currency, r.fees, r.balanceAfterTransaction,
          r.transactionType, r.productOrAccount, r.status, r.direction,
          r.listName, r.groupName, !!r.isRecurring, r.recurringType,
          r.recurringEndType, r.recurringEndDate, r.notes, !!r.isSplit, !!r.isDeleted,
          r.createdAt, r.updatedAt, r.rawData,
        ]
      )
      txCount++
      if (txCount % 500 === 0) console.log(`  ${txCount}/${transactions.length}...`)
    }

    // --- transaction_splits ---
    const splits = sqlite.prepare('SELECT * FROM transaction_splits').all()
    console.log(`Migrating ${splits.length} splits...`)
    for (const r of splits) {
      await client.query(
        `INSERT INTO transaction_splits (id, "transactionId", "listName", "groupName", amount, note, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [r.id, r.transactionId, r.listName, r.groupName, r.amount, r.note, r.createdAt, r.updatedAt]
      )
    }

    // --- budget_goals ---
    const goals = sqlite.prepare('SELECT * FROM budget_goals').all()
    console.log(`Migrating ${goals.length} budget goals...`)
    for (const r of goals) {
      await client.query(
        `INSERT INTO budget_goals (id, "listName", "groupName", month, "goalAmount", direction, period, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [r.id, r.listName, r.groupName, r.month, r.goalAmount, r.direction, r.period ?? 'month', r.createdAt, r.updatedAt]
      )
    }

    // --- import_history ---
    const imports = sqlite.prepare('SELECT * FROM import_history').all()
    console.log(`Migrating ${imports.length} import history entries...`)
    for (const r of imports) {
      await client.query(
        `INSERT INTO import_history (id, "fileName", source, "importedAt", "transactionCount", "duplicateCount")
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [r.id, r.fileName, r.source, r.importedAt, r.transactionCount, r.duplicateCount]
      )
    }

    // --- users ---
    const users = sqlite.prepare('SELECT * FROM users').all()
    console.log(`Migrating ${users.length} users...`)
    for (const r of users) {
      await client.query(
        `INSERT INTO users (id, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [r.id, r.email, r.name, r.passwordHash, r.role, !!r.isActive, r.createdAt, r.updatedAt]
      )
    }

    // --- app_settings ---
    const settings = sqlite.prepare('SELECT * FROM app_settings').all()
    console.log(`Migrating ${settings.length} app settings...`)
    for (const r of settings) {
      await client.query(
        `INSERT INTO app_settings (key, value, "updatedAt") VALUES ($1,$2,$3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = EXCLUDED."updatedAt"`,
        [r.key, r.value, r.updatedAt]
      )
    }

    // --- feedback ---
    const feedback = sqlite.prepare('SELECT * FROM feedback').all()
    console.log(`Migrating ${feedback.length} feedback items...`)
    for (const r of feedback) {
      await client.query(
        `INSERT INTO feedback (id, title, message, type, section, status, created_by, page, admin_reply, unread_by_admin, unread_by_user, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
        [r.id, r.title, r.message, r.type, r.section, r.status, r.created_by, r.page, r.admin_reply, !!r.unread_by_admin, !!r.unread_by_user, r.created_at, r.updated_at]
      )
    }

    // --- feedback_replies ---
    const replies = sqlite.prepare('SELECT * FROM feedback_replies').all()
    console.log(`Migrating ${replies.length} feedback replies...`)
    for (const r of replies) {
      await client.query(
        `INSERT INTO feedback_replies (id, feedback_id, author, message, created_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [r.id, r.feedback_id, r.author, r.message, r.created_at]
      )
    }

    // --- faq_items ---
    const faqs = sqlite.prepare('SELECT * FROM faq_items').all()
    console.log(`Migrating ${faqs.length} FAQ items...`)
    for (const r of faqs) {
      await client.query(
        `INSERT INTO faq_items (id, question, answer, is_published, source_feedback_id, order_index, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [r.id, r.question, r.answer, !!r.is_published, r.source_feedback_id, r.order_index, r.created_at, r.updated_at]
      )
    }

    console.log('\nMigratie voltooid!')
  } finally {
    client.release()
    await pool.end()
    sqlite.close()
  }
}

migrate().catch(err => {
  console.error('Migratie mislukt:', err)
  process.exit(1)
})
