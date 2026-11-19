'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import {
  addProgramme,
  addTitle,
  exportSelectionsCsv,
  exportTitleCatalogueCsv,
  getAdminOverview,
  getAdminTitles,
  importTitlesCsv,
  previewTitlesCsv,
  releaseSelection,
  setProgrammeActive,
  setTitleActive,
  updateProgramme,
  updateTitle,
  type AdminSelection,
  type AdminTitle,
} from '@/app/actions/admin'
import type { ProgrammeOption } from '@/app/actions/portal'
import { authClient } from '@/lib/auth-client'

type DashboardData = {
  counts: { programmes: number; titles: number; selections: number; available: number }
  programmes: (ProgrammeOption & { active: boolean })[]
  selections: AdminSelection[]
  recentAudit: { id: string; action: string; entityType: string; reason: string | null; createdAt: Date }[]
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'catalogue'>('overview')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState(data.selections)
  const [openForm, setOpenForm] = useState<'programme' | 'title' | 'import' | null>(null)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [pending, setPending] = useState(false)
  const [releaseId, setReleaseId] = useState('')
  const [releaseReasonText, setReleaseReasonText] = useState('')
  const [programmeName, setProgrammeName] = useState('')
  const [department, setDepartment] = useState('')
  const [editingProgrammeId, setEditingProgrammeId] = useState('')
  const [editingProgrammeName, setEditingProgrammeName] = useState('')
  const [editingProgrammeDepartment, setEditingProgrammeDepartment] = useState('')
  const [programmeId, setProgrammeId] = useState(data.programmes[0]?.id ?? '')
  const [titleText, setTitleText] = useState('')
  const [titleCategory, setTitleCategory] = useState('')
  const [titleDescription, setTitleDescription] = useState('')
  const [csv, setCsv] = useState('')
  const [csvName, setCsvName] = useState('')
  const [csvPreview, setCsvPreview] = useState<Extract<Awaited<ReturnType<typeof previewTitlesCsv>>, { success: true }> | null>(null)
  const [titleRows, setTitleRows] = useState<AdminTitle[]>([])
  const [titleSearch, setTitleSearch] = useState('')
  const [titleProgrammeFilter, setTitleProgrammeFilter] = useState('all')
  const [titleAvailability, setTitleAvailability] = useState('all')
  const [titlePage, setTitlePage] = useState(0)
  const [titleHasMore, setTitleHasMore] = useState(false)
  const [editingTitleId, setEditingTitleId] = useState('')
  const [editingTitle, setEditingTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingDescription, setEditingDescription] = useState('')

  function flash(message: string, isError = false) {
    setNotice(message)
    setNoticeError(isError)
  }

  async function loadTitles(nextPage = 0) {
    setPending(true)
    try {
      const result = await getAdminTitles(titleSearch, titleProgrammeFilter, titleAvailability, nextPage)
      setTitleRows(result.titles)
      setTitleHasMore(result.hasMore)
      setTitlePage(nextPage)
    } catch { flash('Could not load title records.', true) }
    finally { setPending(false) }
  }

  async function openCatalogue() {
    setActiveTab('catalogue')
    await loadTitles(0)
  }

  async function toggleProgramme(id: string, active: boolean) {
    setPending(true)
    const result = await setProgrammeActive(id, active)
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) router.refresh()
  }

  async function toggleTitle(item: AdminTitle) {
    setPending(true)
    const result = await setTitleActive(item.id, !item.active)
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) { await loadTitles(titlePage); router.refresh() }
  }

  async function saveTitleEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    setPending(true)
    const result = await updateTitle({ id, title: editingTitle, category: editingCategory, description: editingDescription })
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) { setEditingTitleId(''); await loadTitles(titlePage); router.refresh() }
  }

  async function exportTitles() {
    setPending(true)
    try {
      const contents = await exportTitleCatalogueCsv()
      const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `cbe-title-catalogue-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      flash('Title catalogue exported.')
    } catch { flash('Catalogue export failed. Please try again.', true) }
    finally { setPending(false) }
  }

  async function submitProgramme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const result = await addProgramme({ name: programmeName, department })
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) { setProgrammeName(''); setDepartment(''); setOpenForm(null); router.refresh() }
  }

  async function submitProgrammeEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    setPending(true)
    const result = await updateProgramme({ id, name: editingProgrammeName, department: editingProgrammeDepartment })
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) { setEditingProgrammeId(''); router.refresh() }
  }

  async function submitTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const result = await addTitle({ programmeId, title: titleText, category: titleCategory, description: titleDescription })
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) { setTitleText(''); setTitleCategory(''); setTitleDescription(''); setOpenForm(null); await loadTitles(0); router.refresh() }
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!csv) { flash('Choose a CSV file first.', true); return }
    setPending(true)
    const result = await previewTitlesCsv(csv)
    setPending(false)
    if (!result.success) { setCsvPreview(null); flash(result.message, true); return }
    setCsvPreview(result)
    flash(`${result.rowCount.toLocaleString()} title rows validated across ${result.programmeCount} programmes. Review the sample before importing.`)
  }

  async function confirmImport() {
    if (!csv || !csvPreview) return
    setPending(true)
    const result = await importTitlesCsv(csv)
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) { setCsv(''); setCsvName(''); setCsvPreview(null); setOpenForm(null); await loadTitles(0); router.refresh() }
  }

  async function searchSelections(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try { setRows((await getAdminOverview(search)).selections) }
    catch { flash('Could not refresh selection records.', true) }
    finally { setPending(false) }
  }

  async function downloadExport() {
    setPending(true)
    try {
      const contents = await exportSelectionsCsv()
      const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `cbe-selections-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      flash('Selection report exported.')
    } catch { flash('Export failed. Please try again.', true) }
    finally { setPending(false) }
  }

  async function confirmRelease(selectionId: string) {
    setPending(true)
    const result = await releaseSelection(selectionId, releaseReasonText)
    setPending(false)
    flash(result.message, !result.success)
    if (result.success) {
      setReleaseId('')
      setReleaseReasonText('')
      const next = await getAdminOverview(search)
      setRows(next.selections)
      router.refresh()
    }
  }

  async function signOut() {
    await authClient.signOut()
    router.replace('/admin/sign-in')
    router.refresh()
  }

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/"><span className="brand-mark"><span>C</span><span>B</span><span>E</span></span><span><strong>CBE PORTAL</strong><small>ADMINISTRATION</small></span></a>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="admin-nav" aria-label="Admin navigation">
        <button aria-pressed={activeTab === 'overview'} className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><span className="nav-icon"><BookOpen size={17} /></span>Overview</button>
        <button aria-pressed={activeTab === 'catalogue'} className={activeTab === 'catalogue' ? 'active' : ''} onClick={() => void openCatalogue()}><span className="nav-icon"><FileText size={17} /></span>Title catalogue</button>
      </nav>
      <div className="sidebar-bottom"><div className="secure-admin"><ShieldCheck size={17} /><span><strong>Secure workspace</strong><small>Administrator access</small></span></div><button className="sidebar-home" onClick={() => void signOut()}>Sign out <ArrowRight size={14} /></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="breadcrumb">CBE PORTAL <span>/</span> ADMINISTRATION</span><h1>{activeTab === 'overview' ? 'Overview' : 'Title catalogue'}</h1></div><div className="admin-top-actions"><span className="live-indicator"><i /> Live system</span><button className="admin-user" aria-label="Administrator profile">AD</button></div></header>
      <div className="admin-content">
        {notice && <div className={`admin-notice ${noticeError ? 'error' : ''}`} role="status">{noticeError ? <X size={15} /> : <Check size={15} />}{notice}<button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {activeTab === 'overview' ? <>
          <div className="welcome-row"><div><h2>Good day, Administrator</h2><p>Here&apos;s what&apos;s happening across the research title portal.</p></div><button className="admin-primary" onClick={() => { setOpenForm('title'); void openCatalogue() }}><Plus size={16} /> Add a title</button></div>
          <section className="stat-grid" aria-label="Portal summary">
            <article className="stat-card"><div className="stat-top"><span>PROGRAMMES</span><span className="stat-icon green"><BookOpen size={16} /></span></div><strong>{data.counts.programmes.toLocaleString()}</strong><small>Active programmes &amp; courses</small></article>
            <article className="stat-card"><div className="stat-top"><span>APPROVED TITLES</span><span className="stat-icon blue"><FileText size={16} /></span></div><strong>{data.counts.titles.toLocaleString()}</strong><small>Across all programmes</small></article>
            <article className="stat-card"><div className="stat-top"><span>AVAILABLE</span><span className="stat-icon amber"><Check size={16} /></span></div><strong>{data.counts.available.toLocaleString()}</strong><small>Ready for student selection</small></article>
            <article className="stat-card"><div className="stat-top"><span>ALLOCATED</span><span className="stat-icon violet"><Users size={16} /></span></div><strong>{data.counts.selections.toLocaleString()}</strong><small>Active student selections</small></article>
          </section>
          <section className="admin-card selection-card">
            <div className="card-heading"><div><div className="card-eyebrow">LATEST ACTIVITY</div><h3>Student selections</h3><p>Recently confirmed research title reservations.</p></div><button className="export-button" onClick={() => void downloadExport()} disabled={pending}><ArrowDownToLine size={15} /> Export CSV</button></div>
            <form className="admin-search" onSubmit={(event) => void searchSelections(event)}><Search size={16} /><input aria-label="Search student records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, registration number or reference..." /><button type="submit">Search</button></form>
            <SelectionTable rows={rows.slice(0, 8)} releaseId={releaseId} releaseReasonText={releaseReasonText} pending={pending} setReleaseId={setReleaseId} setReleaseReasonText={setReleaseReasonText} onRelease={confirmRelease} />
            <div className="table-footnote">Showing up to 8 most recent active selections.</div>
          </section>
          <div className="admin-lower-grid">
            <section className="admin-card programme-card"><div className="card-heading"><div><div className="card-eyebrow">CATALOGUE</div><h3>Programmes &amp; courses</h3></div><button className="small-add" onClick={() => setOpenForm(openForm === 'programme' ? null : 'programme')}><Plus size={14} /> Add</button></div>
              {openForm === 'programme' && <form className="inline-admin-form" onSubmit={(event) => void submitProgramme(event)}><label>Programme name<input required value={programmeName} onChange={(event) => setProgrammeName(event.target.value)} placeholder="e.g. Bachelor of Accounting" /></label><label>Department (optional)<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Accountancy" /></label><button className="admin-primary" disabled={pending}>Save programme</button></form>}
              <div className="programme-list">{data.programmes.length === 0 && <div className="admin-empty">No programmes yet. Add one to start loading the catalogue.</div>}{data.programmes.slice(0, 5).map((item) => <div className="programme-item" key={item.id}><span className="programme-dot" /><span><strong>{item.name}</strong><small>{item.department || 'No department assigned'}</small></span><span className="programme-count">Active</span></div>)}</div>
            </section>
            <section className="admin-card activity-card"><div className="card-heading"><div><div className="card-eyebrow">AUDIT LOG</div><h3>Recent admin actions</h3></div><span className="audit-badge"><ShieldCheck size={14} /> Recorded</span></div>
              <div className="audit-list">{data.recentAudit.length === 0 && <div className="admin-empty">Administrative changes will appear here as they happen.</div>}{data.recentAudit.map((entry) => <div className="audit-item" key={entry.id}><span className="audit-dot" /><span><strong>{entry.action.replaceAll('.', ' ')}</strong><small>{entry.reason || entry.entityType}</small></span><time>{new Date(entry.createdAt).toLocaleDateString('en-TZ', { month: 'short', day: 'numeric' })}</time></div>)}</div>
            </section>
          </div>
        </> : <>
          <div className="welcome-row"><div><h2>Manage title catalogue</h2><p>Add approved research topics, organise programmes and load titles in bulk.</p></div><div className="catalogue-actions"><button className="admin-secondary" onClick={() => setOpenForm(openForm === 'programme' ? null : 'programme')}><Plus size={15} /> Programme</button><button className="admin-primary" onClick={() => setOpenForm(openForm === 'title' ? null : 'title')}><Plus size={16} /> Add title</button></div></div>
          <div className="catalogue-stats"><span><strong>{data.counts.titles.toLocaleString()}</strong> active titles</span><span><strong>{data.counts.programmes.toLocaleString()}</strong> programmes</span><span>Supports 1,000+ titles per programme</span></div>
          {openForm === 'programme' && <section className="admin-card form-card"><div className="card-heading"><div><div className="card-eyebrow">NEW PROGRAMME</div><h3>Add a programme or course</h3></div><button className="close-form" aria-label="Close form" onClick={() => setOpenForm(null)}><X size={17} /></button></div><form className="admin-form-grid" onSubmit={(event) => void submitProgramme(event)}><label>Programme name<input required value={programmeName} onChange={(event) => setProgrammeName(event.target.value)} placeholder="e.g. Bachelor of Accounting" /></label><label>Department (optional)<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Accountancy" /></label><button className="admin-primary" disabled={pending}>Save programme</button></form></section>}
          {openForm === 'title' && <section className="admin-card form-card"><div className="card-heading"><div><div className="card-eyebrow">NEW CATALOGUE ITEM</div><h3>Add an approved research title</h3></div><button className="close-form" aria-label="Close form" onClick={() => setOpenForm(null)}><X size={17} /></button></div><form className="admin-form-grid title-admin-form" onSubmit={(event) => void submitTitle(event)}><label>Programme / course<div className="admin-select"><select required value={programmeId} onChange={(event) => setProgrammeId(event.target.value)}><option value="">Choose programme</option>{data.programmes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></div></label><label>Category (optional)<input value={titleCategory} onChange={(event) => setTitleCategory(event.target.value)} placeholder="e.g. Finance" /></label><label className="form-full">Title<input required minLength={12} maxLength={500} value={titleText} onChange={(event) => setTitleText(event.target.value)} placeholder="Enter the approved research or project title" /></label><label className="form-full">Description (optional)<textarea rows={3} maxLength={1000} value={titleDescription} onChange={(event) => setTitleDescription(event.target.value)} placeholder="Additional context for students" /></label><button className="admin-primary" disabled={pending || !data.programmes.length}>Save title</button></form></section>}
          {openForm === 'import' && <section className="admin-card form-card"><div className="card-heading"><div><div className="card-eyebrow">SPREADSHEET IMPORT</div><h3>Import titles from CSV</h3><p>Required columns: programme, title. Optional: category, description.</p></div><button className="close-form" aria-label="Close form" onClick={() => setOpenForm(null)}><X size={17} /></button></div><form onSubmit={(event) => void submitImport(event)}><label className="csv-upload"><input aria-label="Choose a CSV title file" type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { setCsv(await file.text()); setCsvName(file.name); setCsvPreview(null) } }} /><FileSpreadsheet size={20} /><span><strong>{csvName || 'Choose a CSV file'}</strong><small>Up to 5,000 rows · 2 MB max</small></span><Upload size={16} /></label><button className="admin-primary import-submit" disabled={pending || !csv}>{csvPreview ? 'Revalidate file' : 'Validate & preview'}</button>{csvPreview && <div className="csv-preview"><div className="csv-preview-heading"><strong><Check size={14} /> {csvPreview.rowCount.toLocaleString()} validated rows</strong><span>{csvPreview.programmeCount} programmes</span></div><div className="csv-preview-table"><div><b>PROGRAMME</b><b>TITLE</b><b>CATEGORY</b></div>{csvPreview.sample.map((row, index) => <div key={`${row.programme}-${index}`}><span>{row.programme}</span><span>{row.title}</span><span>{row.category || '—'}</span></div>)}</div><p>No duplicate or incomplete rows found. Review the sample, then commit the import.</p><div className="csv-preview-actions"><button type="button" className="status-action" onClick={() => { setCsvPreview(null); setCsv(''); setCsvName('') }}>Choose another file</button><button type="button" className="admin-primary" disabled={pending} onClick={() => void confirmImport()}>Import {csvPreview.rowCount.toLocaleString()} titles</button></div></div>}</form></section>}
          <section className="admin-card selection-card catalogue-table-card"><div className="card-heading"><div><div className="card-eyebrow">ALL PROGRAMMES</div><h3>Programme catalogue</h3><p>Manage the programmes and titles available to students.</p></div><button className="export-button" onClick={() => { setOpenForm('import'); window.setTimeout(() => document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }}><Upload size={15} /> Bulk import</button></div>
            {data.programmes.length === 0 ? <div className="large-empty"><span><BookOpen size={22} /></span><strong>Your catalogue starts here</strong><p>Add a programme, then add titles individually or import them from a CSV file.</p><button className="admin-primary" onClick={() => setOpenForm('programme')}><Plus size={15} /> Add programme</button></div> : <div className="programme-catalogue-list">{data.programmes.map((item) => <div className="catalogue-programme" key={item.id}><div><span className="programme-dot" /><span><strong>{item.name}</strong><small>{item.department || 'No department'} · {item.active ? 'Active' : 'Inactive'}</small></span></div><div className="programme-row-actions"><button className="status-action" onClick={() => { setEditingProgrammeId(item.id); setEditingProgrammeName(item.name); setEditingProgrammeDepartment(item.department || '') }}>Edit</button><button className="small-add" onClick={() => { setProgrammeId(item.id); setOpenForm('title'); window.setTimeout(() => document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }}><Plus size={14} /> Add title</button><button className="status-action" disabled={pending} onClick={() => void toggleProgramme(item.id, !item.active)}>{item.active ? 'Deactivate' : 'Activate'}</button></div>{editingProgrammeId === item.id && <form className="programme-edit-form" onSubmit={(event) => void submitProgrammeEdit(event, item.id)}><input aria-label="Programme name" required minLength={3} maxLength={140} value={editingProgrammeName} onChange={(event) => setEditingProgrammeName(event.target.value)} /><input aria-label="Department" maxLength={120} placeholder="Department (optional)" value={editingProgrammeDepartment} onChange={(event) => setEditingProgrammeDepartment(event.target.value)} /><button className="small-add" disabled={pending}>Save</button><button type="button" className="status-action" onClick={() => setEditingProgrammeId('')}>Cancel</button></form>}</div>)}</div>}
          </section>
          <section className="admin-card selection-card title-management-card">
            <div className="card-heading"><div><div className="card-eyebrow">TITLE RECORDS</div><h3>Research title catalogue</h3><p>Search, filter, update or deactivate approved titles.</p></div><button className="export-button" disabled={pending} onClick={() => void exportTitles()}><ArrowDownToLine size={15} /> Export titles</button></div>
            <form className="title-filter-row" onSubmit={(event) => { event.preventDefault(); void loadTitles(0) }}>
              <div className="title-search"><Search size={15} /><input aria-label="Search title records" placeholder="Search title or programme..." value={titleSearch} onChange={(event) => setTitleSearch(event.target.value)} /></div>
              <select aria-label="Filter by programme" value={titleProgrammeFilter} onChange={(event) => setTitleProgrammeFilter(event.target.value)}><option value="all">All programmes</option>{data.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select aria-label="Filter by availability" value={titleAvailability} onChange={(event) => setTitleAvailability(event.target.value)}><option value="all">All availability</option><option value="available">Available</option><option value="allocated">Unavailable</option><option value="inactive">Inactive</option></select>
              <button className="filter-submit" type="submit">Filter</button>
            </form>
            <div className="title-admin-list">
              {titleRows.length === 0 && <div className="admin-empty">{pending ? 'Loading catalogue…' : 'No titles match these filters.'}</div>}
              {titleRows.map((item) => <div className="title-admin-row" key={item.id}>
                {editingTitleId === item.id ? <form className="title-edit-form" onSubmit={(event) => void saveTitleEdit(event, item.id)}><input aria-label="Research title" required minLength={12} maxLength={500} value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} /><div className="title-edit-bottom"><input aria-label="Category" maxLength={100} placeholder="Category" value={editingCategory} onChange={(event) => setEditingCategory(event.target.value)} /><textarea aria-label="Description" rows={2} maxLength={1000} placeholder="Description" value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} /><button className="small-add" disabled={pending}>Save</button><button type="button" className="status-action" onClick={() => setEditingTitleId('')}>Cancel</button></div></form> : <><div className="title-admin-copy"><strong>{item.title}</strong><span>{item.programmeName}{item.category ? ` · ${item.category}` : ''}</span></div><span className={`availability-pill ${!item.active || !item.programmeActive ? 'inactive' : item.unavailable ? 'allocated' : 'available'}`}>{!item.active ? 'INACTIVE' : !item.programmeActive ? 'PROGRAMME OFF' : item.unavailable ? 'UNAVAILABLE' : 'AVAILABLE'}</span><div className="title-admin-actions"><button className="status-action" onClick={() => { setEditingTitleId(item.id); setEditingTitle(item.title); setEditingCategory(item.category || ''); setEditingDescription(item.description || '') }}>Edit</button><button className="status-action" disabled={pending} onClick={() => void toggleTitle(item)}>{item.active ? 'Deactivate' : 'Activate'}</button></div></>}
              </div>)}
            </div>
            <div className="title-list-footer"><span>Page {titlePage + 1} · 50 titles per page</span><div><button disabled={titlePage === 0 || pending} onClick={() => void loadTitles(titlePage - 1)}>Previous</button><button disabled={!titleHasMore || pending} onClick={() => void loadTitles(titlePage + 1)}>Next</button></div></div>
          </section>
          <div className="catalogue-help"><FileSpreadsheet size={17} /><span><strong>Spreadsheet template</strong><small>CSV header row: programme,title,category,description</small></span><button onClick={() => { const csvTemplate = 'programme,title,category,description\n"Bachelor of Accounting","A study of financial reporting practices in small enterprises",Finance,"Optional context"'; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvTemplate], { type: 'text/csv' })); link.download = 'cbe-title-import-template.csv'; link.click(); URL.revokeObjectURL(link.href) }}>Download template <ArrowDownToLine size={14} /></button></div>
        </>}
      </div>
    </main>
  </div>
}

function SelectionTable({ rows, releaseId, releaseReasonText, pending, setReleaseId, setReleaseReasonText, onRelease }: {
  rows: AdminSelection[]
  releaseId: string
  releaseReasonText: string
  pending: boolean
  setReleaseId: (id: string) => void
  setReleaseReasonText: (reason: string) => void
  onRelease: (id: string) => void
}) {
  return <div className="table-scroll"><table className="selection-table"><thead><tr><th>STUDENT</th><th>RESEARCH TITLE</th><th>REFERENCE</th><th>DATE SELECTED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {rows.length === 0 && <tr><td className="empty-table-cell" colSpan={5}>No active selections match this search.</td></tr>}
    {rows.map((item) => <tr key={item.id}><td><strong>{item.fullNames}</strong><small>{item.registrationNumber} · {item.phoneNumber}</small></td><td><strong className="table-title">{item.title}</strong><small>{item.programmeName}</small></td><td><span className="reference-tag">{item.referenceCode}</span></td><td><span className="date-cell">{new Date(item.selectedAt).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td><td>{releaseId === item.id ? <div className="release-inline"><input aria-label="Reason for release" minLength={8} maxLength={500} placeholder="Required release reason" value={releaseReasonText} onChange={(event) => setReleaseReasonText(event.target.value)} /><button disabled={pending || releaseReasonText.trim().length < 8} onClick={() => onRelease(item.id)}>Release</button><button aria-label="Cancel release" onClick={() => setReleaseId('')}><X size={14} /></button></div> : <button className="release-button" onClick={() => { setReleaseId(item.id); setReleaseReasonText('') }}>Release</button>}</td></tr>)}
  </tbody></table></div>
}
