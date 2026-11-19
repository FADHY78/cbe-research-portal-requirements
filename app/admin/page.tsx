import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/portal/admin-dashboard'
import { getAdminOverview } from '@/app/actions/admin'
import { auth } from '@/lib/auth'

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/admin/sign-in')
  if (session.user.role !== 'admin') {
    return <main className="admin-denied"><div className="auth-icon"><span aria-hidden="true">!</span></div><span className="section-kicker">ACCESS RESTRICTED</span><h1>Administrator access required</h1><p>This account does not have permission to manage the CBE research title portal. Contact your system administrator.</p><a className="outline-button" href="/">Return to student portal</a></main>
  }
  const data = await getAdminOverview()
  return <AdminDashboard data={data} />
}
