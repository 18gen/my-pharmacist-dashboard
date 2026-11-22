import type { Redis } from "@upstash/redis"

import { redisFromEnv } from "@/lib/redis"

/**
 * The pictures of scanned pills, as phones send them while sharing: one small JPEG per
 * pill, kept apart from the snapshot that names them, so a snapshot sent every few seconds
 * stays small. They go with the person (stop sharing, Reset demo, 14 days idle) and expire
 * on their own a little after the week a snapshot covers.
 */
export const photoLimits = {
  /** The largest picture taken, in bytes: the app sends about 10 KB. */
  bytes: 48 * 1024,
  /** The most pictures kept for one person: a week of scans, with room to spare. */
  perPatient: 300,
  /** How long a picture is kept, in seconds: a week, and a day for the time zones. */
  seconds: 8 * 24 * 60 * 60,
} as const

export interface PhotoStore {
  put(patientId: string, photoId: string, jpeg: Uint8Array): Promise<void>
  get(patientId: string, photoId: string): Promise<Uint8Array<ArrayBuffer> | null>
  /** How many pictures are kept for this person. */
  count(patientId: string): Promise<number>
  /** Forgets every picture of these people. */
  removePatients(patientIds: string[]): Promise<void>
}

/** Upstash Redis: each picture in base64 under its own key, and a set of each person's. */
class RedisPhotoStore implements PhotoStore {
  constructor(private readonly redis: Redis) {}

  private static photoKey(patientId: string, photoId: string): string {
    return `photo:${patientId}:${photoId}`
  }

  private static setKey(patientId: string): string {
    return `photos:${patientId}`
  }

  async put(patientId: string, photoId: string, jpeg: Uint8Array): Promise<void> {
    const set = RedisPhotoStore.setKey(patientId)
    await this.redis
      .multi()
      .set(RedisPhotoStore.photoKey(patientId, photoId), Buffer.from(jpeg).toString("base64"), { ex: photoLimits.seconds })
      .sadd(set, photoId)
      .expire(set, photoLimits.seconds)
      .exec()
  }

  async get(patientId: string, photoId: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const base64 = await this.redis.get<string>(RedisPhotoStore.photoKey(patientId, photoId))
    return typeof base64 === "string" ? new Uint8Array(Buffer.from(base64, "base64")) : null
  }

  async count(patientId: string): Promise<number> {
    return this.redis.scard(RedisPhotoStore.setKey(patientId))
  }

  async removePatients(patientIds: string[]): Promise<void> {
    for (const patientId of patientIds) {
      const set = RedisPhotoStore.setKey(patientId)
      const photoIds = await this.redis.smembers(set)
      await this.redis.del(set, ...photoIds.map((photoId) => RedisPhotoStore.photoKey(patientId, photoId)))
    }
  }
}

/** In memory, for `npm run dev` and tests: gone when the server stops. */
class MemoryPhotoStore implements PhotoStore {
  private readonly byPatient = new Map<string, Map<string, { jpeg: Uint8Array<ArrayBuffer>; expires: number }>>()

  async put(patientId: string, photoId: string, jpeg: Uint8Array): Promise<void> {
    const photos = this.byPatient.get(patientId) ?? new Map()
    photos.set(photoId, { jpeg: new Uint8Array(jpeg), expires: Date.now() + photoLimits.seconds * 1000 })
    this.byPatient.set(patientId, photos)
  }

  async get(patientId: string, photoId: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const photo = this.byPatient.get(patientId)?.get(photoId)
    return photo && photo.expires > Date.now() ? photo.jpeg : null
  }

  async count(patientId: string): Promise<number> {
    return this.byPatient.get(patientId)?.size ?? 0
  }

  async removePatients(patientIds: string[]): Promise<void> {
    for (const patientId of patientIds) this.byPatient.delete(patientId)
  }
}

// Kept on globalThis so the dev server's reloads don't empty the in-memory store.
const shared = globalThis as typeof globalThis & { photoStore?: PhotoStore }

/** Redis when it is set up, memory otherwise; on Vercel without Redis, an error (as `patientStore`). */
export function photoStore(): PhotoStore {
  if (shared.photoStore) return shared.photoStore
  const redis = redisFromEnv()
  if (!redis && process.env.VERCEL) {
    throw new Error("No database: connect Upstash Redis to this Vercel project.")
  }
  shared.photoStore = redis ? new RedisPhotoStore(redis) : new MemoryPhotoStore()
  return shared.photoStore
}

/** Whether `bytes` start as every JPEG does (FF D8 FF). */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

/** A picture's ID as the app makes them: a UUID, any case. */
export function isPhotoId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
