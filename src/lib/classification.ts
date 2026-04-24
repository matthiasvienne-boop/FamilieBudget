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
  const value = rule.matchValue.toLowerCase()

  switch (rule.matchType) {
    case 'description_contains':
      return (transaction.description?.toLowerCase() ?? '').includes(value)

    case 'counterparty_exact':
      return (transaction.counterparty?.toLowerCase() ?? '') === value

    case 'merchant_exact':
      return (transaction.merchant?.toLowerCase() ?? '') === value

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
