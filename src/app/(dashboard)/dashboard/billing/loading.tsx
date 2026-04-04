import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function BillingLoading() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Skeleton className="h-8 w-24" />
      <Card>
        <CardHeader className="space-y-1.5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}
