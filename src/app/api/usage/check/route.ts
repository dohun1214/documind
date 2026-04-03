import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkDailyUsage } from '@/lib/usage/check'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const action = request.nextUrl.searchParams.get('action') ?? 'default'

  const usage = await checkDailyUsage(user.id, action)

  return NextResponse.json(usage)
}
