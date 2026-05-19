import { ClassificationRule, Transaction } from '@/types'

export function applyRules(
  transaction: Partial<Transaction>,
  rules: ClassificationRule[]
): Partial<Transaction> {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  for (const rule of sorted) {
    if (matchesRule(transaction, rule)) {
      return {
        ...transaction,
        listName: rule.listName ?? transaction.listName,
        groupName: rule.groupName ?? transaction.groupName,
        isRecurring: rule.isRecurring,
        recurringType: rule.recurringType,
        recurringEndType: rule.recurringEndType ?? transaction.recurringEndType,
        recurringEndDate: rule.recurringEndDate ?? transaction.recurringEndDate,
      }
    }
  }

  return transaction
}

export function matchesRule(
  transaction: Partial<Transaction>,
  rule: ClassificationRule
): boolean {
  // If rule is scoped to a specific account, only match transactions on that account
  if (rule.accountId && transaction.accountId !== rule.accountId) return false

  const value = rule.matchValue.toLowerCase()
  const merchant = (transaction.merchant ?? '').toLowerCase()
  const counterparty = (transaction.counterparty ?? '').toLowerCase()
  const description = (transaction.description ?? '').toLowerCase()

  switch (rule.matchType) {
    case 'description_contains':
      return description.includes(value)

    case 'counterparty_exact':
      // Also match if merchant equals the value (Revolut stores name in merchant)
      return counterparty === value || merchant === value

    case 'merchant_exact':
      // Also match if counterparty contains the value (Crelan stores name in counterparty)
      return merchant === value || counterparty.includes(value)

    case 'amount_exact':
      return Math.abs(transaction.amount ?? 0) === Math.abs(parseFloat(rule.matchValue))

    default:
      return false
  }
}

export function buildDuplicateKey(tx: Partial<Transaction>): string {
  // Revolut: sourceTransactionId = Startdatum timestamp → uniek per transactie
  // Crelan: sourceTransactionId = transactienummer
  const extra = tx.sourceTransactionId ?? tx.completedDate ?? ''

  return [
    tx.source,
    tx.transactionDate,
    String(tx.amount),
    (tx.description ?? '').slice(0, 50),
    tx.counterparty ?? '',
    extra,
  ]
    .join('|')
    .toLowerCase()
}
