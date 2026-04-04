import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function DocumentLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <Skeleton className="h-6 flex-1 max-w-sm" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-lg" />
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: doc info panel */}
        <div className="w-72 shrink-0 rounded-xl border bg-card p-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI panel */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b px-4 gap-1 py-1">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-9 w-20 rounded-none" />
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 p-5 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      </div>
    </div>
  )
}
