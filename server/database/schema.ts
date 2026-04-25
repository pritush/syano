import { bigint, boolean, doublePrecision, inet, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const tags = pgTable('tags', {
  id: varchar('id', { length: 64 }).primaryKey().notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
})

export const links = pgTable('links', {
  id: varchar('id', { length: 64 }).primaryKey().notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  url: text('url').notNull(),
  comment: text('comment'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  expiration: bigint('expiration', { mode: 'number' }),
  title: text('title'),
  description: text('description'),
  image: text('image'),
  apple: text('apple'),
  google: text('google'),
  cloaking: boolean('cloaking').default(false),
  redirect_with_query: boolean('redirect_with_query').default(false),
  password: text('password'),
  unsafe: boolean('unsafe').default(false),
  tag_id: varchar('tag_id', { length: 64 }).references(() => tags.id, { onDelete: 'set null' }),
})

export const access_logs = pgTable('access_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  link_id: varchar('link_id', { length: 64 }).references(() => links.id, { onDelete: 'set null' }),
  slug: varchar('slug', { length: 128 }),
  url: text('url'),
  ua: text('ua'),
  ip: inet('ip'),
  referer: text('referer'),
  country: varchar('country', { length: 120 }),
  region: text('region'),
  city: text('city'),
  timezone: text('timezone'),
  language: text('language'),
  os: text('os'),
  browser: text('browser'),
  browser_type: text('browser_type'),
  device: text('device'),
  device_type: text('device_type'),
  latitude: doublePrecision('latitude').default(0),
  longitude: doublePrecision('longitude').default(0),
  utm_source: varchar('utm_source', { length: 128 }),
  utm_medium: varchar('utm_medium', { length: 128 }),
  utm_campaign: varchar('utm_campaign', { length: 128 }),
  utm_term: varchar('utm_term', { length: 128 }),
  utm_content: varchar('utm_content', { length: 128 }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
})

export const site_settings = pgTable('site_settings', {
  id: varchar('id', { length: 8 }).primaryKey().notNull(),
  homepage_mode: varchar('homepage_mode', { length: 20 }),
  redirect_url: varchar('redirect_url', { length: 2048 }),
  redirect_timeout: bigint('redirect_timeout', { mode: 'number' }).default(3),
  bio_content: jsonb('bio_content'),
})

export const qr_scans = pgTable('qr_scans', {
  id: uuid('id').defaultRandom().primaryKey(),
  link_id: varchar('link_id', { length: 64 }).references(() => links.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 128 }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  display_name: varchar('display_name', { length: 120 }),
  password_hash: text('password_hash').notNull(),
  permissions: text('permissions').array().notNull().default([]),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
})
