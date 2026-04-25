import BudgetContent from '@/components/budget/BudgetContent'

export default function BudgetPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Budget & doelen</h1>
        <p className="text-slate-500 text-sm mt-1">Stel maandelijkse doelen per categorie in</p>
      </div>
      <BudgetContent />
    </div>
  )
}
