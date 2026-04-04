import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function UploadLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}
