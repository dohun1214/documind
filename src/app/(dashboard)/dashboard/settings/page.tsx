import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from 'lucide-react'

export const metadata = { title: '설정' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            프로필
          </CardTitle>
          <CardDescription>계정 정보</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">이름</p>
            <p className="font-medium">{profile?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">이메일</p>
            <p className="font-medium">{user.email}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
