'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'

export function AdminSetup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, setupCode }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.message ?? 'The administrator account could not be created. Please try again.')
        return
      }
      setComplete(true)
      setPassword('')
      setSetupCode('')
    } catch {
      setError('Unable to complete setup right now. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="admin-auth-shell">
    <div className="admin-auth-top"><Link className="brand-lockup" href="/"><span className="brand-mark"><span>C</span><span>B</span><span>E</span></span><span className="brand-copy"><strong>COLLEGE OF BUSINESS EDUCATION</strong><small>RESEARCH TITLE PORTAL</small></span></Link><Link className="auth-back" href="/admin/sign-in"><ArrowLeft size={15} /> Administrator sign in</Link></div>
    <section className="admin-auth-card">
      <div className="auth-icon"><KeyRound size={20} /></div><span className="section-kicker">ONE-TIME SECURE SETUP</span><h1>Create the first administrator</h1>
      {complete ? <>
        <p>Your CBE administrator account is ready. Sign in with the email and password you just created.</p>
        <Link className="primary-button auth-submit" href="/admin/sign-in">Continue to sign in <ArrowRight size={16} /></Link>
      </> : <>
        <p>Choose the administrator email and password. You will also need the one-time setup code provided by your system administrator.</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>Full name<input type="text" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" /></label>
          <label>Administrator email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@cbe.ac.tz" /></label>
          <label>Create password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /><small>Use at least 12 characters. Choose a unique password.</small></label>
          <label>One-time setup code<input type="password" autoComplete="off" required maxLength={512} value={setupCode} onChange={(event) => setSetupCode(event.target.value)} placeholder="Enter your setup code" /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create administrator account'} <ArrowRight size={16} /></button>
        </form>
        <div className="auth-security"><ShieldCheck size={16} /><span><strong>One-time protection</strong><small>This setup closes automatically after the first account is created. Your password is securely hashed and never sent through chat.</small></span></div>
      </>}
    </section>
    <footer className="auth-footer">© {new Date().getFullYear()} College of Business Education <span>·</span> Student research allocation</footer>
  </main>
}
