import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'budget.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      sourceFileName TEXT NOT NULL DEFAULT '',
      sourceTransactionId TEXT,
      transactionDate TEXT NOT NULL,
      completedDate TEXT,
      description TEXT NOT NULL DEFAULT '',
      counterparty TEXT,
      merchant TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      fees REAL NOT NULL DEFAULT 0,
      balanceAfterTransaction REAL,
      transactionType TEXT,
      productOrAccount TEXT,
      status TEXT,
      direction TEXT NOT NULL DEFAULT 'expense',
      listName TEXT,
      groupName TEXT,
      isRecurring INTEGER NOT NULL DEFAULT 0,
      recurringType TEXT NOT NULL DEFAULT 'one_time',
      recurringEndType TEXT,
      recurringEndDate TEXT,
      notes TEXT,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      rawData TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transactionDate);
    CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);
    CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);
    CREATE INDEX IF NOT EXISTS idx_transactions_list ON transactions(listName);
    CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(isDeleted);

    CREATE TABLE IF NOT EXISTS transaction_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_groups (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      listName TEXT NOT NULL,
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (listId) REFERENCES transaction_lists(id) ON DELETE CASCADE,
      UNIQUE(listName, name)
    );

    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY,
      matchType TEXT NOT NULL,
      matchValue TEXT NOT NULL,
      listName TEXT,
      groupName TEXT,
      isRecurring INTEGER NOT NULL DEFAULT 0,
      recurringType TEXT NOT NULL DEFAULT 'one_time',
      recurringEndType TEXT,
      recurringEndDate TEXT,
      applyToFutureImports INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      source TEXT NOT NULL,
      importedAt TEXT NOT NULL,
      transactionCount INTEGER NOT NULL DEFAULT 0,
      duplicateCount INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budget_goals (
      id TEXT PRIMARY KEY,
      listName TEXT NOT NULL,
      groupName TEXT NOT NULL DEFAULT '',
      month TEXT NOT NULL DEFAULT '',
      goalAmount REAL NOT NULL,
      direction TEXT NOT NULL DEFAULT 'expense',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(listName, groupName, month)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  seedDefaultLists(db)
}

function seedDefaultLists(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM transaction_lists').get() as { c: number }).c
  if (count > 0) return

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

  const groups: Array<{ id: string; listId: string; listName: string; name: string; sortOrder: number }> = [
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

  const insertList = db.prepare(
    'INSERT OR IGNORE INTO transaction_lists (id, name, color, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertGroup = db.prepare(
    'INSERT OR IGNORE INTO transaction_groups (id, listId, listName, name, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )

  for (const l of lists) insertList.run(l.id, l.name, l.color, l.sortOrder, now, now)
  for (const g of groups) insertGroup.run(g.id, g.listId, g.listName, g.name, g.sortOrder, now, now)
}
