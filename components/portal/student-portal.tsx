'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  GraduationCap,
  LockKeyhole,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { getCatalogue, reserveTitle, type CatalogueTitle, type ProgrammeOption } from '@/app/actions/portal'

type Profile = {
  registrationNumber: string
  fullNames: string
  phoneNumber: string
  programmeId: string
}

type Confirmation = {
  referenceCode: string
  selectedAt: string
  title: string
  programmeName: string
  phoneNumber: string
}

const steps = ['Your details', 'Choose a title', 'Confirmation']

export function StudentPortal({ programmes }: { programmes: ProgrammeOption[] }) {
  const [step, setStep] = useState<'identity' | 'catalogue' | 'confirm' | 'success'>('identity')
  const [profile, setProfile] = useState<Profile>({ registrationNumber: '', fullNames: '', phoneNumber: '', programmeId: '' })
  const [page, setPage] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState<CatalogueTitle | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)

  const catalogueKey = step === 'catalogue' && profile.programmeId
    ? ['cbe-catalogue', profile.programmeId, searchText, category, page] as const
    : null
  const { data: catalogueData, isLoading: catalogueLoading, isValidating: catalogueRefreshing, error: catalogueError, mutate: refreshCatalogue } = useSWR(
    catalogueKey,
    ([, programmeId, search, selectedCategory, currentPage]) => getCatalogue(programmeId, search, selectedCategory, currentPage),
    { refreshInterval: 15_000, revalidateOnFocus: true, keepPreviousData: true, dedupingInterval: 5_000 },
  )
  const catalogue = catalogueData?.titles ?? []
  const hasMore = catalogueData?.hasMore ?? false
  const programme = programmes.find((item) => item.id === profile.programmeId)
  const categories = Array.from(new Set(catalogue.map((item) => item.category).filter((item): item is string => Boolean(item))))

  function loadCatalogue(nextPage = 0, nextSearch = searchText, nextCategory = category) {
    setPage(nextPage)
    setSearchText(nextSearch)
    setCategory(nextCategory)
    setNotice('')
  }

  async function continueToCatalogue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile.programmeId) {
      setNotice('Select your programme or course to continue.')
      return
    }
    loadCatalogue(0, '', 'all')
    setStep('catalogue')
  }

  async function confirmSelection() {
    if (!selected) return
    setPending(true)
    setNotice('')
    let result
    try {
      result = await reserveTitle({ ...profile, titleId: selected.id })
    } catch {
      setPending(false)
      setNotice('We could not complete your selection right now. Please try again.')
      return
    }
    setPending(false)
    if (!result.success) {
      setNotice(result.message)
      if (result.message.includes('just reserved')) { setSelected(null); setStep('catalogue') }
      return
    }
    setConfirmation(result)
    setStep('success')
  }

  function updateProfile(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <Link className="brand-lockup" href="/" aria-label="CBE research title portal home">
          <span className="brand-mark"><span>C</span><span>B</span><span>E</span></span>
          <span className="brand-copy"><strong>COLLEGE OF BUSINESS EDUCATION</strong><small>RESEARCH TITLE PORTAL</small></span>
        </Link>
        <div className="header-actions">
          <a className="help-link" href="#student-support"><CircleHelp size={16} /> Help</a>
          <Link href="/admin/sign-in" className="admin-link"><LockKeyhole size={15} /> Admin access</Link>
        </div>
      </header>

      <main className="portal-main">
        <div className="page-intro">
          <div className="eyebrow"><span className="eyebrow-dot" /> STUDENT RESEARCH ALLOCATION</div>
          <h1>Find the question<br className="desktop-break" /> you want to answer.</h1>
          <p>Choose one approved research title for your programme. Browse what is available and secure your selection in a few simple steps.</p>
        </div>

        <section className="selection-panel" aria-label="Student title selection">
          <div className="panel-topline">
            <div className="panel-title"><span className="panel-icon"><BookOpen size={18} /></span><div><strong>Title selection</strong><small>One student · one research title</small></div></div>
            <span className="identity-note"><ShieldCheck size={14} /> Details are not independently verified</span>
          </div>

          {step !== 'success' && <div className="step-progress" aria-label={`Step ${step === 'identity' ? 1 : step === 'catalogue' ? 2 : 3} of 3`}>
            {steps.map((label, index) => {
              const current = step === 'identity' ? 0 : step === 'catalogue' ? 1 : 2
              const complete = index < current
              return <div className={`step-item ${index === current ? 'is-current' : ''} ${complete ? 'is-complete' : ''}`} key={label}>
                <span className="step-number">{complete ? <Check size={13} /> : `0${index + 1}`}</span><span>{label}</span>
              </div>
            })}
          </div>}

          {notice && <div className="portal-alert" role="alert">{notice}</div>}

          {step === 'identity' && <form className="identity-form" onSubmit={continueToCatalogue}>
            <div className="form-heading"><div><span className="section-kicker">LET&apos;S GET STARTED</span><h2>Tell us about yourself</h2><p>Use the details you normally provide to your department.</p></div><span className="form-illustration"><GraduationCap size={23} /></span></div>
            <div className="field-grid">
              <label className="portal-field"><span>Registration number <i>*</i></span><input required autoComplete="off" maxLength={32} placeholder="e.g. CBE/2023/0142" value={profile.registrationNumber} onChange={(event) => updateProfile('registrationNumber', event.target.value)} /></label>
              <label className="portal-field"><span>Full names <i>*</i></span><input required autoComplete="name" maxLength={120} placeholder="As shown on your student records" value={profile.fullNames} onChange={(event) => updateProfile('fullNames', event.target.value)} /></label>
              <label className="portal-field"><span>Active phone number <i>*</i></span><div className="phone-entry"><span>+255</span><input required type="tel" autoComplete="tel-national" inputMode="tel" placeholder="7XX XXX XXX" value={profile.phoneNumber} onChange={(event) => updateProfile('phoneNumber', event.target.value)} /></div><small>Enter the 9 digits after +255, or a local 0XX number.</small></label>
              <label className="portal-field"><span>Programme / course <i>*</i></span><div className="select-wrap"><select required value={profile.programmeId} onChange={(event) => updateProfile('programmeId', event.target.value)}><option value="">Choose your programme</option>{programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
            </div>
            {programmes.length === 0 && <div className="empty-programmes"><span className="empty-icon"><FileText size={18} /></span><div><strong>Programme list is being prepared</strong><p>Please check back soon or contact your department.</p></div></div>}
            <div className="form-footer"><span><LockKeyhole size={14} /> Used only for allocation and related communication.</span><button className="primary-button" type="submit" disabled={pending || programmes.length === 0}>Browse titles <ArrowRight size={16} /></button></div>
          </form>}

          {step === 'catalogue' && <div className="catalogue-view">
            <div className="catalogue-heading"><div><span className="section-kicker">YOUR PROGRAMME</span><h2>{programme?.name ?? 'Available research titles'}</h2><p>Select one title from the approved catalogue.</p></div><button className="text-button" type="button" onClick={() => setStep('identity')}><ArrowLeft size={15} /> Edit details</button></div>
            <form className="search-row" onSubmit={(event) => { event.preventDefault(); void loadCatalogue(0, searchText, category) }}>
              <div className="search-box"><Search size={17} /><input aria-label="Search titles" placeholder="Search by title or keyword..." value={searchText} onChange={(event) => setSearchText(event.target.value)} /></div>
              <button className="filter-button" type="button" aria-label="Reset filters" onClick={() => { setSearchText(''); setCategory('all'); void loadCatalogue(0, '', 'all') }}><SlidersHorizontal size={17} /></button>
              <button className="search-submit" type="submit">Search</button>
            </form>
            <div className="catalogue-meta"><span><span className="available-dot" /> Available to select</span><span><span className="unavailable-dot" /> Already selected</span>{catalogueRefreshing && <span className="refreshing-status">Updating availability…</span>}<span className="meta-total"><FileText size={14} /> Browse the catalogue</span></div>
            {categories.length > 0 && <div className="category-row"><button className={`category-chip ${category === 'all' ? 'active' : ''}`} type="button" onClick={() => { setCategory('all'); void loadCatalogue(0, searchText, 'all') }}>All topics</button>{categories.map((item) => <button className={`category-chip ${category === item ? 'active' : ''}`} type="button" key={item} onClick={() => { setCategory(item); void loadCatalogue(0, searchText, item) }}>{item}</button>)}</div>}
            <div className="title-list" aria-live="polite">
              {catalogue.map((item, index) => <article className={`title-card ${item.unavailable ? 'is-unavailable' : ''}`} key={item.id}>
                <span className="title-index">{String(page * 8 + index + 1).padStart(2, '0')}</span>
                <div className="title-card-copy"><div className="title-labels">{item.category && <span className="topic-tag">{item.category}</span>}{item.unavailable && <span className="unavailable-label">UNAVAILABLE</span>}</div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div>
                {item.unavailable ? <span className="unavailable-action">Already selected</span> : <button className="choose-button" type="button" onClick={() => { setSelected(item); setNotice(''); setStep('confirm') }}>Choose title <ArrowRight size={15} /></button>}
              </article>)}
              {!catalogueLoading && !catalogueError && catalogue.length === 0 && <div className="empty-catalogue"><span className="empty-icon"><BookOpen size={20} /></span><strong>No titles found</strong><p>{searchText ? 'Try a different keyword or clear your search.' : 'No approved titles have been added to this programme yet.'}</p></div>}
              {catalogueLoading && <div className="catalogue-loading" role="status">Loading titles…</div>}{catalogueError && <div className="catalogue-error" role="alert">The catalogue could not be refreshed. <button type="button" onClick={() => void refreshCatalogue()}>Try again</button></div>}
            </div>
            <div className="catalogue-footer"><span>Availability updates as students complete their selection.</span><div className="pagination"><button type="button" aria-label="Previous page" disabled={page === 0 || pending} onClick={() => void loadCatalogue(page - 1)}><ArrowLeft size={15} /></button><span>Page {page + 1}</span><button type="button" aria-label="Next page" disabled={!hasMore || pending} onClick={() => void loadCatalogue(page + 1)}><ArrowRight size={15} /></button></div></div>
          </div>}

          {step === 'confirm' && selected && <div className="confirm-view">
            <button className="text-button back-link" type="button" onClick={() => setStep('catalogue')}><ArrowLeft size={15} /> Back to titles</button>
            <span className="section-kicker">REVIEW BEFORE SUBMITTING</span><h2>Is this your choice?</h2><p className="confirm-intro">Take a moment to review your details. Once confirmed, your selection cannot be changed here.</p>
            <div className="review-title"><div className="review-mark"><BookOpen size={19} /></div><div><span>{selected.category || 'Research title'} · {programme?.name}</span><strong>{selected.title}</strong></div></div>
            <div className="review-details"><div><span>Student</span><strong>{profile.fullNames}</strong></div><div><span>Registration number</span><strong>{profile.registrationNumber.trim().toUpperCase()}</strong></div><div><span>Phone number</span><strong>{profile.phoneNumber}</strong></div></div>
            <div className="warning-note"><ShieldCheck size={17} /><p>By confirming, you reserve this title for yourself. Your details are captured as entered and are not verified against an official student register.</p></div>
            <div className="form-footer"><button className="text-button" type="button" onClick={() => setStep('catalogue')}>Cancel</button><button className="primary-button" type="button" onClick={() => void confirmSelection()} disabled={pending}>Confirm selection <ArrowRight size={16} /></button></div>
          </div>}

          {step === 'success' && confirmation && <div className="success-view">
            <div className="success-icon"><BadgeCheck size={31} /></div><span className="section-kicker">SELECTION CONFIRMED</span><h2>You&apos;re all set.</h2><p className="success-intro">Your research title has been reserved. Keep this confirmation for your records.</p>
            <div className="reference-ticket"><div className="ticket-label"><span>CONFIRMATION REFERENCE</span><span><Check size={13} /> Saved</span></div><strong>{confirmation.referenceCode}</strong><div className="ticket-divider" /><span className="ticket-title-label">SELECTED TITLE</span><b>{confirmation.title}</b><div className="ticket-meta"><span>{confirmation.programmeName}</span><span><Clock3 size={13} /> {new Date(confirmation.selectedAt).toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' })}</span></div></div>
            <p className="success-footnote">A title cannot be changed through this portal. Please contact your programme office if you need assistance.</p><button className="outline-button" type="button" onClick={() => window.print()}>Print confirmation <FileText size={15} /></button>
          </div>}
        </section>

        <div className="trust-row"><div><ShieldCheck size={16} /><span>Fair allocation</span><small>One title per student</small></div><div><Clock3 size={16} /><span>Live availability</span><small>Refreshes every 15 seconds</small></div><div><BookOpen size={16} /><span>Approved catalogue</span><small>Curated by your department</small></div></div>
      </main>
      <div className="student-support" id="student-support"><CircleHelp size={16} /><span><strong>Need help selecting a title?</strong> Contact your programme office for questions about eligibility or corrections.</span></div>
      <footer className="portal-footer"><span>© {new Date().getFullYear()} College of Business Education</span><span>Academic research &amp; project allocation</span><span className="footer-privacy"><LockKeyhole size={12} /> Student details are kept private</span></footer>
    </div>
  )
}
