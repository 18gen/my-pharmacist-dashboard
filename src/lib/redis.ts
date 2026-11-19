import { Redis } from "@upstash/redis"

/**
 * The Upstash Redis database, or null when none is set up. Vercel's Upstash integration
 * sets KV_REST_API_URL and KV_REST_API_TOKEN; a database made at upstash.com gives
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Either pair works.
 */
export function redisFromEnv(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}
