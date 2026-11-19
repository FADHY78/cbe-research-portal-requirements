'use server'

import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLogs, programmes, selections, students, titles } from '@/lib/db/schema'

async function requireAdministrator() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.role !== 'admin') throw new Error('Unauthorized')
  return session.user
}

export type AdminSelection = {
  id: string
  referenceCode: string
  registrationNumber: string
  fullNames: string
  phoneNumber: string
  programmeName: string
  title: string
  selectedAt: string
}

export async function getAdminOverview(searchTerm = '') {
  await requireAdministrator()
  const [programmeCount] = await db.select({ value: count() }).from(programmes).where(eq(programmes.active, true))
  const [titleCount] = await db.select({ value: count() }).from(titles).innerJoin(programmes, eq(titles.programmeId, programmes.id)).where(and(eq(titles.active, true), eq(programmes.active, true)))
  const [selectionCount] = await db.select({ value: count() }).from(selections).where(eq(selections.status, 'active'))
  const [availableCount] = await db
    .select({ value: count() })
    .from(titles)
    .leftJoin(selections, and(eq(selections.titleId, titles.id), eq(selections.status, 'active')))
    .where(and(eq(titles.active, true), sql`${selections.id} IS NULL`))

  const term = searchTerm.trim()
  const searchFilter = term
    ? or(
        ilike(students.registrationNumber, `%${term}%`),
        ilike(students.fullNames, `%${term}%`),
        ilike(titles.title, `%${term}%`),
        ilike(selections.referenceCode, `%${term}%`),
      )
    : undefined
  const selectedRows = await db
    .select({
      id: selections.id,
      referenceCode: selections.referenceCode,
      registrationNumber: students.registrationNumber,
      fullNames: students.fullNames,
      phoneNumber: students.phoneNumber,
      programmeName: programmes.name,
      title: titles.title,
      selectedAt: selections.selectedAt,
    })
    .from(selections)
    .innerJoin(students, eq(selections.studentId, students.id))
    .innerJoin(titles, eq(selections.titleId, titles.id))
    .innerJoin(programmes, eq(students.programmeId, programmes.id))
    .where(and(eq(selections.status, 'active'), searchFilter))
    .orderBy(desc(selections.selectedAt))
    .limit(100)

  const programmeRows = await db.select().from(programmes).orderBy(asc(programmes.name))
  const recentAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8)
  return {
    counts: { programmes: programmeCount.value, titles: titleCount.value, selections: selectionCount.value, available: availableCount.value },
    programmes: programmeRows,
    selections: selectedRows.map((row) => ({ ...row, selectedAt: row.selectedAt.toISOString() })),
    recentAudit,
  }
}

export async function addProgramme(input: { name: string; department: string }) {
  const admin = await requireAdministrator()
  const name = input.name.trim()
  const department = input.department.trim()
  if (name.length < 3 || name.length > 140) return { success: false, message: 'Enter a programme name between 3 and 140 characters.' }
  try {
    const [programme] = await db.insert(programmes).values({ name, department: department || null }).returning()
    await db.insert(auditLogs).values({ actorId: admin.id, action: 'programme.created', entityType: 'programme', entityId: programme.id, afterData: { name, department } })
    return { success: true, message: `${name} has been added.` }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return { success: false, message: 'A programme with this name already exists.' }
    return { success: false, message: 'The programme could not be saved. Please try again.' }
  }
}

export async function addTitle(input: { programmeId: string; title: string; category: string; description: string }) {
  const admin = await requireAdministrator()
  const title = input.title.trim()
  const category = input.category.trim()
  const description = input.description.trim()
  if (!/^[0-9a-f-]{36}$/i.test(input.programmeId)) return { success: false, message: 'Choose a valid programme.' }
  if (title.length < 12 || title.length > 500) return { success: false, message: 'Title must contain between 12 and 500 characters.' }
  try {
    const [programme] = await db.select({ name: programmes.name }).from(programmes).where(and(eq(programmes.id, input.programmeId), eq(programmes.active, true))).limit(1)
    if (!programme) return { success: false, message: 'That programme is inactive or no longer available.' }
    const [existing] = await db.select({ id: titles.id }).from(titles).where(and(eq(titles.programmeId, input.programmeId), ilike(titles.title, title))).limit(1)
    if (existing) return { success: false, message: 'This title already exists in the selected programme.' }
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(titles).values({ programmeId: input.programmeId, title, category: category || null, description: description || null }).returning()
      await tx.insert(auditLogs).values({ actorId: admin.id, action: 'title.created', entityType: 'title', entityId: created.id, afterData: { title, programme: programme.name } })
    })
    return { success: true, message: 'Research title added to the catalogue.' }
  } catch {
    return { success: false, message: 'The title could not be saved. Please try again.' }
  }
}

export type AdminTitle = {
  id: string
  title: string
  category: string | null
  description: string | null
  programmeId: string
  programmeName: string
  active: boolean
  programmeActive: boolean
  unavailable: boolean
}

export async function getAdminTitles(searchTerm = '', programmeId = 'all', availability = 'all', page = 0) {
  await requireAdministrator()
  const filters = []
  if (programmeId !== 'all') filters.push(eq(titles.programmeId, programmeId))
  if (availability === 'available') filters.push(and(eq(titles.active, true), eq(programmes.active, true), sql`${selections.id} IS NULL`))
  if (availability === 'allocated') filters.push(and(eq(titles.active, true), sql`${selections.id} IS NOT NULL`))
  if (availability === 'inactive') filters.push(eq(titles.active, false))
  const term = searchTerm.trim()
  if (term) filters.push(or(ilike(titles.title, `%${term}%`), ilike(programmes.name, `%${term}%`)))
  const rows = await db
    .select({
      id: titles.id,
      title: titles.title,
      category: titles.category,
      description: titles.description,
      programmeId: titles.programmeId,
      programmeName: programmes.name,
      active: titles.active,
      programmeActive: programmes.active,
      selectedId: selections.id,
    })
    .from(titles)
    .innerJoin(programmes, eq(titles.programmeId, programmes.id))
    .leftJoin(selections, and(eq(selections.titleId, titles.id), eq(selections.status, 'active')))
    .where(and(...filters))
    .orderBy(asc(programmes.name), asc(titles.title))
    .limit(51)
    .offset(Math.max(0, page) * 50)
  const result: AdminTitle[] = rows.slice(0, 50).map(({ selectedId, ...row }) => ({ ...row, unavailable: selectedId !== null }))
  return { titles: result, hasMore: rows.length > 50 }
}

export async function updateTitle(input: { id: string; title: string; category: string; description: string }) {
  const admin = await requireAdministrator()
  const title = input.title.trim()
  const category = input.category.trim()
  const description = input.description.trim()
  if (!/^[0-9a-f-]{36}$/i.test(input.id) || title.length < 12 || title.length > 500) {
    return { success: false, message: 'Enter a valid title between 12 and 500 characters.' }
  }
  try {
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(titles).where(eq(titles.id, input.id)).for('update')
      if (!before) throw new Error('TITLE_NOT_FOUND')
      const [updated] = await tx.update(titles).set({ title, category: category || null, description: description || null, updatedAt: new Date() }).where(eq(titles.id, input.id)).returning()
      await tx.insert(auditLogs).values({ actorId: admin.id, action: 'title.updated', entityType: 'title', entityId: input.id, beforeData: before, afterData: updated })
    })
    return { success: true, message: 'Title updated.' }
  } catch {
    return { success: false, message: 'The title could not be updated. Check that another active title does not use the same name.' }
  }
}

export async function setTitleActive(id: string, active: boolean) {
  const admin = await requireAdministrator()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, message: 'Invalid title.' }
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(titles).where(eq(titles.id, id)).for('update')
      if (!before) return { success: false, message: 'Title not found.' }
      if (!active && before.active) {
        const [selection] = await tx.select({ id: selections.id }).from(selections).where(and(eq(selections.titleId, id), eq(selections.status, 'active'))).limit(1)
        if (selection) return { success: false, message: 'Release its active student selection before deactivating this title.' }
      }
      const [updated] = await tx.update(titles).set({ active, updatedAt: new Date() }).where(eq(titles.id, id)).returning()
      await tx.insert(auditLogs).values({ actorId: admin.id, action: active ? 'title.activated' : 'title.deactivated', entityType: 'title', entityId: id, beforeData: before, afterData: updated })
      return { success: true, message: active ? 'Title activated.' : 'Title deactivated.' }
    })
  } catch {
    return { success: false, message: 'The title could not be updated.' }
  }
}

export async function updateProgramme(input: { id: string; name: string; department: string }) {
  const admin = await requireAdministrator()
  const name = input.name.trim()
  const department = input.department.trim()
  if (!/^[0-9a-f-]{36}$/i.test(input.id) || name.length < 3 || name.length > 140) {
    return { success: false, message: 'Enter a valid programme name between 3 and 140 characters.' }
  }
  try {
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(programmes).where(eq(programmes.id, input.id)).for('update')
      if (!before) throw new Error('PROGRAMME_NOT_FOUND')
      const [updated] = await tx.update(programmes).set({ name, department: department || null, updatedAt: new Date() }).where(eq(programmes.id, input.id)).returning()
      await tx.insert(auditLogs).values({ actorId: admin.id, action: 'programme.updated', entityType: 'programme', entityId: input.id, beforeData: before, afterData: updated })
    })
    return { success: true, message: 'Programme updated.' }
  } catch {
    return { success: false, message: 'The programme could not be updated. Check that another programme does not use this name.' }
  }
}

export async function setProgrammeActive(id: string, active: boolean) {
  const admin = await requireAdministrator()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, message: 'Invalid programme.' }
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(programmes).where(eq(programmes.id, id)).for('update')
      if (!before) return { success: false, message: 'Programme not found.' }
      const [updated] = await tx.update(programmes).set({ active, updatedAt: new Date() }).where(eq(programmes.id, id)).returning()
      await tx.insert(auditLogs).values({ actorId: admin.id, action: active ? 'programme.activated' : 'programme.deactivated', entityType: 'programme', entityId: id, beforeData: before, afterData: updated })
      return { success: true, message: active ? 'Programme activated.' : 'Programme deactivated.' }
    })
  } catch {
    return { success: false, message: 'The programme could not be updated.' }
  }
}

export async function exportTitleCatalogueCsv() {
  await requireAdministrator()
  const rows = await db
    .select({ programme: programmes.name, title: titles.title, category: titles.category, description: titles.description, status: titles.active, availability: selections.id })
    .from(titles)
    .innerJoin(programmes, eq(titles.programmeId, programmes.id))
    .leftJoin(selections, and(eq(selections.titleId, titles.id), eq(selections.status, 'active')))
    .orderBy(asc(programmes.name), asc(titles.title))
  const escape = (value: string | boolean | null) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const lines = [['Programme', 'Title', 'Category', 'Description', 'Active', 'Availability'], ...rows.map((row) => [row.programme, row.title, row.category, row.description, row.status, row.availability ? 'Unavailable' : 'Available'])]
  return lines.map((line) => line.map(escape).join(',')).join('\r\n')
}

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i]
    if (character === '"' && quoted && source[i + 1] === '"') { cell += '"'; i += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += character
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row) }
  return rows
}

export async function previewTitlesCsv(source: string) {
  await requireAdministrator()
  if (source.length > 2_000_000) return { success: false as const, message: 'CSV must be smaller than 2 MB.' }
  const rows = parseCsv(source)
  if (rows.length < 2) return { success: false as const, message: 'Add a header row and at least one title.' }
  const header = rows[0].map((value) => value.toLowerCase().replace(/\\s+/g, '_'))
  const programmeIndex = header.indexOf('programme')
  const titleIndex = header.indexOf('title')
  if (programmeIndex < 0 || titleIndex < 0) return { success: false as const, message: 'CSV needs programme and title columns. Optional columns: category, description.' }
  const categoryIndex = header.indexOf('category')
  const descriptionIndex = header.indexOf('description')
  const values = rows.slice(1).map((row, index) => ({
    line: index + 2,
    programme: row[programmeIndex]?.trim() ?? '',
    title: row[titleIndex]?.trim() ?? '',
    category: categoryIndex >= 0 ? row[categoryIndex]?.trim() ?? '' : '',
    description: descriptionIndex >= 0 ? row[descriptionIndex]?.trim() ?? '' : '',
  }))
  if (values.length > 5000) return { success: false as const, message: 'Import up to 5,000 titles at a time.' }
  const invalid = values.filter((row) => !row.programme || row.title.length < 12 || row.title.length > 500)
  if (invalid.length) return { success: false as const, message: `Review row${invalid.length > 1 ? 's' : ''} ${invalid.slice(0, 8).map((row) => row.line).join(', ')}: programme and a 12–500 character title are required.` }
  const duplicateLines = new Set<number>()
  const seen = new Set<string>()
  for (const row of values) {
    const key = `${row.programme.toLocaleLowerCase()}::${row.title.toLocaleLowerCase()}`
    if (seen.has(key)) duplicateLines.add(row.line)
    seen.add(key)
  }
  if (duplicateLines.size) return { success: false as const, message: `Duplicate titles found on rows ${Array.from(duplicateLines).slice(0, 8).join(', ')}. No rows were imported.` }
  const programmesList = await db.select({ id: programmes.id, name: programmes.name }).from(programmes).where(eq(programmes.active, true))
  const programmeMap = new Map(programmesList.map((item) => [item.name.toLocaleLowerCase(), item]))
  const missing = Array.from(new Set(values.map((row) => row.programme).filter((name) => !programmeMap.has(name.toLocaleLowerCase()))))
  if (missing.length) return { success: false as const, message: `Unknown programme: ${missing.slice(0, 4).join(', ')}. Add the programme before importing.` }
  for (const programme of programmesList) {
    const incoming = values.filter((row) => programmeMap.get(row.programme.toLocaleLowerCase())?.id === programme.id)
    if (!incoming.length) continue
    const existing = await db.select({ title: titles.title }).from(titles).where(and(eq(titles.programmeId, programme.id), eq(titles.active, true)))
    const existingTitles = new Set(existing.map((item) => item.title.toLocaleLowerCase()))
    const duplicate = incoming.find((row) => existingTitles.has(row.title.toLocaleLowerCase()))
    if (duplicate) return { success: false as const, message: `Duplicate title on row ${duplicate.line}. No rows were imported.` }
  }
  return {
    success: true as const,
    rowCount: values.length,
    programmeCount: new Set(values.map((row) => row.programme.toLocaleLowerCase())).size,
    sample: values.slice(0, 6).map(({ programme, title, category }) => ({ programme, title, category })),
  }
}

export async function importTitlesCsv(source: string) {
  const admin = await requireAdministrator()
  if (source.length > 2_000_000) return { success: false, message: 'CSV must be smaller than 2 MB.' }
  const rows = parseCsv(source)
  if (rows.length < 2) return { success: false, message: 'Add a header row and at least one title.' }
  const headers = rows[0].map((value) => value.toLowerCase().replace(/\s+/g, '_'))
  const programmeIndex = headers.indexOf('programme')
  const titleIndex = headers.indexOf('title')
  if (programmeIndex < 0 || titleIndex < 0) return { success: false, message: 'CSV needs programme and title columns. Optional columns: category, description.' }
  const categoryIndex = headers.indexOf('category')
  const descriptionIndex = headers.indexOf('description')
  const values = rows.slice(1).map((row, index) => ({
    line: index + 2,
    programme: row[programmeIndex]?.trim() ?? '',
    title: row[titleIndex]?.trim() ?? '',
    category: categoryIndex >= 0 ? row[categoryIndex]?.trim() ?? '' : '',
    description: descriptionIndex >= 0 ? row[descriptionIndex]?.trim() ?? '' : '',
  }))
  if (values.length > 5000) return { success: false, message: 'Import up to 5,000 titles at a time.' }
  const invalid = values.filter((row) => !row.programme || row.title.length < 12 || row.title.length > 500)
  if (invalid.length) return { success: false, message: `Review row${invalid.length > 1 ? 's' : ''} ${invalid.slice(0, 8).map((row) => row.line).join(', ')}: programme and a 12–500 character title are required.` }

  const programmeRows = await db.select({ id: programmes.id, name: programmes.name }).from(programmes).where(eq(programmes.active, true))
  const programmeMap = new Map(programmeRows.map((item) => [item.name.toLocaleLowerCase(), item]))
  const missingProgrammes = Array.from(new Set(values.map((row) => row.programme).filter((name) => !programmeMap.has(name.toLocaleLowerCase()))))
  if (missingProgrammes.length) return { success: false, message: `Unknown programme: ${missingProgrammes.slice(0, 4).join(', ')}. Add the programme before importing.` }

  const duplicateLines = new Set<number>()
  const uniqueRows = new Set<string>()
  for (const row of values) {
    const key = `${row.programme.toLocaleLowerCase()}::${row.title.toLocaleLowerCase()}`
    if (uniqueRows.has(key)) duplicateLines.add(row.line)
    uniqueRows.add(key)
  }
  if (duplicateLines.size) return { success: false, message: `Duplicate titles found on rows ${Array.from(duplicateLines).slice(0, 8).join(', ')}. No rows were imported.` }

  try {
    await db.transaction(async (tx) => {
      for (const programme of programmeRows) {
        const incoming = values.filter((row) => programmeMap.get(row.programme.toLocaleLowerCase())?.id === programme.id)
        if (!incoming.length) continue
        const existingRows = await tx.select({ title: titles.title }).from(titles).where(and(eq(titles.programmeId, programme.id), eq(titles.active, true)))
        const existingTitles = new Set(existingRows.map((item) => item.title.toLocaleLowerCase()))
        const duplicate = incoming.find((row) => existingTitles.has(row.title.toLocaleLowerCase()))
        if (duplicate) throw new Error(`Duplicate title on row ${duplicate.line}. No rows were imported.`)
      }
      await tx.insert(titles).values(values.map((row) => ({
        programmeId: programmeMap.get(row.programme.toLocaleLowerCase())!.id,
        title: row.title,
        category: row.category || null,
        description: row.description || null,
      })))
      await tx.insert(auditLogs).values({ actorId: admin.id, action: 'titles.imported', entityType: 'title-catalogue', entityId: 'bulk', reason: `${values.length} title rows imported`, afterData: { rows: values.length } })
    })
    return { success: true, message: `${values.length} titles imported successfully.` }
  } catch (error) {
    return { success: false, message: error instanceof Error && error.message.startsWith('Duplicate title') ? error.message : 'The import could not be completed. No rows were added.' }
  }
}

export async function releaseSelection(selectionId: string, reason: string) {
  const admin = await requireAdministrator()
  const cleanReason = reason.trim()
  if (!/^[0-9a-f-]{36}$/i.test(selectionId) || cleanReason.length < 8 || cleanReason.length > 500) {
    return { success: false, message: 'Provide a reason of at least 8 characters.' }
  }
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(selections).where(and(eq(selections.id, selectionId), eq(selections.status, 'active'))).for('update')
      if (!before) return { success: false, message: 'That selection is no longer active.' }
      await tx.update(selections).set({ status: 'released', releasedAt: new Date(), releaseReason: cleanReason }).where(eq(selections.id, selectionId))
      await tx.insert(auditLogs).values({ actorId: admin.id, action: 'selection.released', entityType: 'selection', entityId: selectionId, reason: cleanReason, beforeData: before, afterData: { status: 'released', reason: cleanReason } })
      return { success: true, message: 'Selection released and recorded in the audit history.' }
    })
  } catch {
    return { success: false, message: 'The selection could not be released. Please try again.' }
  }
}

export async function exportSelectionsCsv() {
  await requireAdministrator()
  const rows = await db
    .select({ referenceCode: selections.referenceCode, registrationNumber: students.registrationNumber, fullNames: students.fullNames, phoneNumber: students.phoneNumber, programme: programmes.name, title: titles.title, selectedAt: selections.selectedAt })
    .from(selections)
    .innerJoin(students, eq(selections.studentId, students.id))
    .innerJoin(titles, eq(selections.titleId, titles.id))
    .innerJoin(programmes, eq(students.programmeId, programmes.id))
    .where(eq(selections.status, 'active'))
    .orderBy(desc(selections.selectedAt))
  const escape = (value: string | Date) => `"${String(value).replaceAll('"', '""')}"`
  const lines = [['Reference', 'Registration number', 'Full names', 'Phone', 'Programme', 'Title', 'Selected at'], ...rows.map((row) => [row.referenceCode, row.registrationNumber, row.fullNames, row.phoneNumber, row.programme, row.title, row.selectedAt.toISOString()])]
  return lines.map((line) => line.map(escape).join(',')).join('\r\n')
}
