import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Skeleton className="h-8 w-16" />
      <Card>
        <CardHeader className="space-y-1.5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-52" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
