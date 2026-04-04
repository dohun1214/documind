'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ProfileData = { full_name: string | null; email: string }

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setProfile({
            full_name: data?.full_name ?? null,
            email: user.email ?? '',
          })
        })
    })
  }, [])

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
          {profile === null ? (
            <>
              <div className="space-y-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-52" />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-muted-foreground">이름</p>
                <p className="font-medium">{profile.full_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">이메일</p>
                <p className="font-medium">{profile.email}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
