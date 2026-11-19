import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminSignIn } from '@/components/portal/admin-sign-in'
import { auth } from '@/lib/auth'

export default async function AdminSignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user?.role === 'admin') redirect('/admin')
  return <AdminSignIn />
}
