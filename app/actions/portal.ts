'use server'

import { randomBytes } from 'node:crypto'
import { and, asc, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { programmes, selections, students, titles } from '@/lib/db/schema'

export type ProgrammeOption = { id: string; name: string; department: string | null }
export type CatalogueTitle = {
  id: string
  title: string
  category: string | null
  description: string | null
  programmeName: string
  unavailable: boolean
}

export async function getProgrammes(): Promise<ProgrammeOption[]> {
  return db
    .select({ id: programmes.id, name: programmes.name, department: programmes.department })
    .from(programmes)
    .where(eq(programmes.active, true))
    .orderBy(asc(programmes.name))
}

export async function getCatalogue(
  programmeId: string,
  searchText = '',
  category = 'all',
  page = 0,
): Promise<{ titles: CatalogueTitle[]; hasMore: boolean }> {
  const filters = [eq(titles.programmeId, programmeId), eq(titles.active, true), eq(programmes.active, true)]
  const term = searchText.trim()
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
    filters.push(
      or(ilike(titles.title, pattern), ilike(titles.category, pattern)) as (typeof filters)[number],
    )
  }
  if (category !== 'all') filters.push(eq(titles.category, category))

  const rows = await db
    .select({
      id: titles.id,
      title: titles.title,
      category: titles.category,
      description: titles.description,
      programmeName: programmes.name,
      selectedId: selections.id,
    })
    .from(titles)
    .innerJoin(programmes, eq(titles.programmeId, programmes.id))
    .leftJoin(selections, and(eq(selections.titleId, titles.id), eq(selections.status, 'active')))
    .where(and(...filters))
    .orderBy(asc(titles.title))
    .limit(9)
    .offset(Math.max(0, page) * 9)

  const titlesOnPage = rows.map(({ selectedId, ...item }) => ({
    ...item,
    unavailable: selectedId !== null,
  }))
  return { titles: titlesOnPage.slice(0, 8), hasMore: titlesOnPage.length > 8 }
}

function normalizeRegistrationNumber(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function normalizeTanzanianPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length === 10) digits = `255${digits.slice(1)}`
  if (digits.length === 9 && /^[67-9]/.test(digits)) digits = `255${digits}`
  if (!/^255[67-9]\d{8}$/.test(digits)) return null
  return `+${digits}`
}

export async function reserveTitle(input: {
  registrationNumber: string
  fullNames: string
  phoneNumber: string
  programmeId: string
  titleId: string
}): Promise<
  | { success: true; referenceCode: string; selectedAt: string; title: string; programmeName: string; phoneNumber: string }
  | { success: false; message: string }
> {
  const registrationNumber = normalizeRegistrationNumber(input.registrationNumber)
  const fullNames = input.fullNames.trim().replace(/\\s+/g, ' ')
  const phoneNumber = normalizeTanzanianPhone(input.phoneNumber)
  if (registrationNumber.length < 4 || registrationNumber.length > 32) {
    return { success: false, message: 'Enter a valid registration number.' }
  }
  if (fullNames.length < 3 || fullNames.length > 120) {
    return { success: false, message: 'Enter your full names as shown on your student records.' }
  }
  if (!phoneNumber) return { success: false, message: 'Enter a valid Tanzanian mobile number.' }
  if (!/^[0-9a-f-]{36}$/i.test(input.programmeId) || !/^[0-9a-f-]{36}$/i.test(input.titleId)) {
    return { success: false, message: 'Choose a programme and an available title.' }
  }

  try {
    return await db.transaction(async (tx) => {
      const [titleRow] = await tx
        .select({ id: titles.id, title: titles.title, programmeId: titles.programmeId, programmeName: programmes.name })
        .from(titles)
        .innerJoin(programmes, eq(titles.programmeId, programmes.id))
        .where(and(eq(titles.id, input.titleId), eq(titles.programmeId, input.programmeId), eq(titles.active, true), eq(programmes.active, true)))
        .for('update')
      if (!titleRow) throw new Error('TITLE_UNAVAILABLE')

      const [existingStudent] = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.registrationNumber, registrationNumber))
        .limit(1)
      if (existingStudent) {
        const [existingSelection] = await tx
          .select({ id: selections.id })
          .from(selections)
          .where(and(eq(selections.studentId, existingStudent.id), eq(selections.status, 'active')))
          .limit(1)
        if (existingSelection) throw new Error('STUDENT_ALREADY_SELECTED')
      }

      const [student] = await tx
        .insert(students)
        .values({ registrationNumber, fullNames, phoneNumber, programmeId: input.programmeId })
        .onConflictDoUpdate({
          target: students.registrationNumber,
          set: { fullNames, phoneNumber, programmeId: input.programmeId, updatedAt: new Date() },
        })
        .returning({ id: students.id })

      const referenceCode = `CBE-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`
      const [selection] = await tx
        .insert(selections)
        .values({ referenceCode, studentId: student.id, titleId: titleRow.id })
        .returning({ selectedAt: selections.selectedAt })

      return {
        success: true as const,
        referenceCode,
        selectedAt: selection.selectedAt.toISOString(),
        title: titleRow.title,
        programmeName: titleRow.programmeName,
        phoneNumber,
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'STUDENT_ALREADY_SELECTED') {
      return { success: false, message: 'This registration number already has an active title selection. Please contact the department if you need help.' }
    }
    if (message === 'TITLE_UNAVAILABLE') {
      return { success: false, message: 'That title was just reserved by another student. Please choose another available title.' }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      const [student] = await db.select({ id: students.id }).from(students).where(eq(students.registrationNumber, registrationNumber)).limit(1)
      if (student) {
        const [activeSelection] = await db.select({ id: selections.id }).from(selections).where(and(eq(selections.studentId, student.id), eq(selections.status, 'active'))).limit(1)
        if (activeSelection) return { success: false, message: 'This registration number already has an active title selection. Please contact the department if you need help.' }
      }
      return { success: false, message: 'That title was just reserved by another student. Please choose another available title.' }
    }
    return { success: false, message: 'We could not complete your selection right now. Please try again.' }
  }
}
