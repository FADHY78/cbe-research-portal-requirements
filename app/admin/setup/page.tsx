import { redirect } from 'next/navigation'
import { AdminSetup } from '@/components/portal/admin-setup'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

export default async function AdminSetupPage() {
  const [existingUser] = await db.select({ id: user.id }).from(user).limit(1)
  if (existingUser) redirect('/admin/sign-in')
  if (!process.env.CBE_ADMIN_SETUP_TOKEN || process.env.CBE_ADMIN_SETUP_TOKEN.length < 32) {
    return <main className="admin-denied"><div className="auth-icon"><span aria-hidden="true">!</span></div><span className="section-kicker">SETUP UNAVAILABLE</span><h1>Administrator setup is not available</h1><p>Contact your system administrator to enable the one-time account setup.</p><a className="outline-button" href="/admin/sign-in">Return to sign in</a></main>
  }
  return <AdminSetup />
}
