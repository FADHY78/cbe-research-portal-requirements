import { randomUUID, timingSafeEqual } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { account, user } from '@/lib/db/schema'

export const runtime = 'nodejs'

function constantTimeMatches(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate)
  const expectedBuffer = Buffer.from(expected)
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer)
}

export async function POST(request: Request) {
  const setupToken = process.env.CBE_ADMIN_SETUP_TOKEN
  if (!setupToken || setupToken.length < 32) {
    return NextResponse.json({ message: 'Initial administrator setup is unavailable.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Enter valid setup details.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'Enter valid setup details.' }, { status: 400 })
  }

  const { name, email, password, setupCode } = body as Record<string, unknown>
  if (
    typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 ||
    typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' || password.length < 12 || password.length > 128 ||
    typeof setupCode !== 'string' || setupCode.length > 512 || !constantTimeMatches(setupCode, setupToken)
  ) {
    return NextResponse.json({ message: 'The details could not be verified. Check them and try again.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const userId = randomUUID()
  const timestamp = new Date()
  const passwordHash = await hashPassword(password)

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(741852963)`)
      const [existingUser] = await tx.select({ id: user.id }).from(user).limit(1)
      if (existingUser) throw new Error('INITIAL_ADMIN_ALREADY_EXISTS')

      await tx.insert(user).values({
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        emailVerified: false,
        role: 'admin',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: normalizedEmail,
        providerId: 'credential',
        userId,
        password: passwordHash,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ message: 'Initial setup is already complete or could not be saved.' }, { status: 409 })
  }
}
