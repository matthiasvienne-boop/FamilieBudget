export type Direction = 'income' | 'expense' | 'transfer'
export type Source = 'revolut' | 'crelan'
export type RecurringType = 'one_time' | 'recurring'
export type RecurringEndType = 'ongoing' | 'ends_on_date'
export type MatchType = 'description_contains' | 'counterparty_exact' | 'merchant_exact' | 'amount_exact'

export interface Transaction {
  id: string
  source: Source
  sourceFileName: string
  sourceTransactionId: string | null
  transactionDate: string
  completedDate: string | null
  description: string
  counterparty: string | null
  merchant: string | null
  amount: number
  currency: string
  fees: number
  balanceAfterTransaction: number | null
  transactionType: string | null
  productOrAccount: string | null
  status: string | null
  direction: Direction
  listName: string | null
  groupName: string | null
  isRecurring: boolean
  recurringType: RecurringType
  recurringEndType: RecurringEndType | null
  recurringEndDate: string | null
  notes: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  rawData: string | null
}

export interface TransactionList {
  id: string
  name: string
  color: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TransactionGroup {
  id: string
  listId: string
  listName: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ClassificationRule {
  id: string
  matchType: MatchType
  matchValue: string
  listName: string | null
  groupName: string | null
  isRecurring: boolean
  recurringType: RecurringType
  recurringEndType: RecurringEndType | null
  recurringEndDate: string | null
  applyToFutureImports: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface ImportResult {
  imported: number
  skipped: number
  duplicates: number
  errors: string[]
  transactions: Transaction[]
}

export interface BulkUpdatePayload {
  ids: string[]
  listName?: string | null
  groupName?: string | null
  isRecurring?: boolean
  recurringType?: RecurringType
  recurringEndType?: RecurringEndType | null
  recurringEndDate?: string | null
  notes?: string | null
}

export interface TransactionFilters {
  month?: string
  source?: Source | ''
  listName?: string
  groupName?: string
  direction?: Direction | ''
  isRecurring?: boolean | null
  uncategorized?: boolean
  search?: string
  page?: number
  pageSize?: number
}

export interface MonthlyStats {
  month: string
  income: number
  expenses: number
  cashflow: number
  transactionCount: number
}
