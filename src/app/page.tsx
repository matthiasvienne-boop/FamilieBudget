import DashboardContent from '@/components/dashboard/DashboardContent'

export default function HomePage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overzicht van uw gezinsbudget</p>
      </div>
      <DashboardContent />
    </div>
  )
}
