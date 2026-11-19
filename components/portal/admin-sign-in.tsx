'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export function AdminSignIn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    let result
    try {
      result = await authClient.signIn.email({ email, password })
    } catch {
      setPending(false)
      setError('Unable to sign in right now. Please try again.')
      return
    }
    setPending(false)
    if (result.error) {
      setError('Unable to sign in with those details. Check your credentials or contact your system administrator.')
      return
    }
    router.replace('/admin')
    router.refresh()
  }

  return <main className="admin-auth-shell">
    <div className="admin-auth-top"><Link className="brand-lockup" href="/"><span className="brand-mark"><span>C</span><span>B</span><span>E</span></span><span className="brand-copy"><strong>COLLEGE OF BUSINESS EDUCATION</strong><small>RESEARCH TITLE PORTAL</small></span></Link><Link className="auth-back" href="/"><ArrowLeft size={15} /> Student portal</Link></div>
    <section className="admin-auth-card">
      <div className="auth-icon"><LockKeyhole size={20} /></div><span className="section-kicker">AUTHORISED STAFF ONLY</span><h1>Administrator sign in</h1><p>Sign in with your CBE portal administrator account to manage the research catalogue and student allocations.</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@cbe.ac.tz" /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={16} /></button>
      </form>
      <div className="auth-security"><ShieldCheck size={16} /><span><strong>Secure access</strong><small>Administrator accounts are provisioned by your system administrator. Public sign-up is disabled.</small></span></div>
    </section>
    <footer className="auth-footer">© {new Date().getFullYear()} College of Business Education <span>·</span> Student research allocation</footer>
  </main>
}
