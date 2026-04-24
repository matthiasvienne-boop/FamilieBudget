import clsx from 'clsx'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'income' | 'expense' | 'transfer' | 'recurring' | 'custom'
  color?: string
  className?: string
}

export default function Badge({ children, variant = 'default', color, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variant === 'income' && 'bg-green-100 text-green-700',
        variant === 'expense' && 'bg-red-100 text-red-700',
        variant === 'transfer' && 'bg-slate-100 text-slate-600',
        variant === 'recurring' && 'bg-purple-100 text-purple-700',
        variant === 'default' && !color && 'bg-slate-100 text-slate-600',
        className
      )}
      style={color ? { backgroundColor: `${color}20`, color } : undefined}
    >
      {children}
    </span>
  )
}
