import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'


export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('student'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
})

export const programmes = pgTable('cbe_programmes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  department: text('department'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const titles = pgTable('cbe_titles', {
  id: uuid('id').primaryKey().defaultRandom(),
  programmeId: uuid('programme_id').notNull().references(() => programmes.id),
  title: text('title').notNull(),
  category: text('category'),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('cbe_titles_programme_active_idx').on(table.programmeId, table.active),
  uniqueIndex('cbe_titles_active_programme_title_unique')
    .on(table.programmeId, sql`lower(${table.title})`)
    .where(sql`${table.active} = true`),
])

export const students = pgTable('cbe_students', {
  id: uuid('id').primaryKey().defaultRandom(),
  registrationNumber: text('registration_number').notNull().unique(),
  fullNames: text('full_names').notNull(),
  phoneNumber: text('phone_number').notNull(),
  programmeId: uuid('programme_id').notNull().references(() => programmes.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const selections = pgTable('cbe_selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceCode: text('reference_code').notNull().unique(),
  studentId: uuid('student_id').notNull().references(() => students.id),
  titleId: uuid('title_id').notNull().references(() => titles.id),
  status: text('status').notNull().default('active'),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releaseReason: text('release_reason'),
}, (table) => [
  uniqueIndex('cbe_selection_active_title_unique').on(table.titleId).where(sql`${table.status} = 'active'`),
  uniqueIndex('cbe_selection_active_student_unique').on(table.studentId).where(sql`${table.status} = 'active'`),
])

export const auditLogs = pgTable('cbe_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  reason: text('reason'),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
