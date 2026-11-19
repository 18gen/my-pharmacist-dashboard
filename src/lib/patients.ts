import type { Redis } from "@upstash/redis"

import { redisFromEnv } from "@/lib/redis"
import type { Snapshot } from "@/lib/snapshot"

/** Someone sharing from the app: the name they typed and what their phone last sent. */
export interface Patient {
  /** Random, given when they start sharing; the only thing that tells two "Maria"s apart. */
  id: string
  name: string
  joinedAt: string
  updatedAt: string
  /** Null until the phone sends its first snapshot. */
  snapshot: Snapshot | null
}

/**
 * Where the people sharing are kept. Every change bumps `version`, which the dashboard's
 * polls are compared against, so a poll when nothing changed costs one read.
 */
export interface PatientStore {
  version(): Promise<number>
  all(): Promise<Patient[]>
  get(id: string): Promise<Patient | null>
  count(): Promise<number>
  /** Adds or replaces one. */
  put(patient: Patient): Promise<void>
  remove(ids: string[]): Promise<void>
  removeAll(): Promise<void>
}

/** Upstash Redis: one hash of everyone, by ID, and a counter of changes. */
class RedisPatientStore implements PatientStore {
  private static readonly key = "patients"
  private static readonly versionKey = "patients:version"

  constructor(private readonly redis: Redis) {}

  async version(): Promise<number> {
    return (await this.redis.get<number>(RedisPatientStore.versionKey)) ?? 0
  }

  async all(): Promise<Patient[]> {
    const byID = await this.redis.hgetall<Record<string, Patient>>(RedisPatientStore.key)
    return byID ? Object.values(byID) : []
  }

  async get(id: string): Promise<Patient | null> {
    return (await this.redis.hget<Patient>(RedisPatientStore.key, id)) ?? null
  }

  async count(): Promise<number> {
    return this.redis.hlen(RedisPatientStore.key)
  }

  async put(patient: Patient): Promise<void> {
    await this.redis
      .multi()
      .hset(RedisPatientStore.key, { [patient.id]: patient })
      .incr(RedisPatientStore.versionKey)
      .exec()
  }

  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const [first, ...rest] = ids
    await this.redis
      .multi()
      .hdel(RedisPatientStore.key, first, ...rest)
      .incr(RedisPatientStore.versionKey)
      .exec()
  }

  async removeAll(): Promise<void> {
    await this.redis.multi().del(RedisPatientStore.key).incr(RedisPatientStore.versionKey).exec()
  }
}

/** In memory, for `npm run dev` and tests: gone when the server stops. */
class MemoryPatientStore implements PatientStore {
  private readonly patients = new Map<string, Patient>()
  private changes = 0

  async version(): Promise<number> {
    return this.changes
  }

  async all(): Promise<Patient[]> {
    return [...this.patients.values()]
  }

  async get(id: string): Promise<Patient | null> {
    return this.patients.get(id) ?? null
  }

  async count(): Promise<number> {
    return this.patients.size
  }

  async put(patient: Patient): Promise<void> {
    this.patients.set(patient.id, patient)
    this.changes += 1
  }

  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    for (const id of ids) this.patients.delete(id)
    this.changes += 1
  }

  async removeAll(): Promise<void> {
    this.patients.clear()
    this.changes += 1
  }
}

// Kept on globalThis so the dev server's reloads don't empty the in-memory store.
const shared = globalThis as typeof globalThis & { patientStore?: PatientStore }

/**
 * Redis when it is set up. Otherwise memory, which only works on one long-running
 * server: on Vercel each request may run somewhere new, so there it is an error instead
 * of a store that silently forgets.
 */
export function patientStore(): PatientStore {
  if (shared.patientStore) return shared.patientStore
  const redis = redisFromEnv()
  if (!redis && process.env.VERCEL) {
    throw new Error("No database: connect Upstash Redis to this Vercel project.")
  }
  shared.patientStore = redis ? new RedisPatientStore(redis) : new MemoryPatientStore()
  return shared.patientStore
}
