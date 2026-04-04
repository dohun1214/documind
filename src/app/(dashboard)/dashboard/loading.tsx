import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Document cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
