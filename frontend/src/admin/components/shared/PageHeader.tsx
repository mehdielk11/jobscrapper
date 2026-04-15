import React from 'react'
interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

/**
 * Consistent page header with title, description, and optional action slot (buttons etc).
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Sora',sans-serif] tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
