import { Ratelimit } from "@upstash/ratelimit"

import { redisFromEnv } from "@/lib/redis"

/**
 * - join: people starting to share, per network address. A classroom shares one
 *   address, so it is generous.
 * - write: snapshots, per person. A phone sends at most a couple a second while in use.
 */
const rules = {
  join: Ratelimit.slidingWindow(60, "1 m"),
  write: Ratelimit.slidingWindow(120, "1 m"),
} as const

export type LimitKind = keyof typeof rules

const limiters = new Map<LimitKind, Ratelimit>()

/** Whether another request of this kind from `key` is allowed now. Always, without Redis. */
export async function allow(kind: LimitKind, key: string): Promise<boolean> {
  let limiter = limiters.get(kind)
  if (!limiter) {
    const redis = redisFromEnv()
    if (!redis) return true
    limiter = new Ratelimit({ redis, limiter: rules[kind], prefix: `ratelimit:${kind}` })
    limiters.set(kind, limiter)
  }
  const { success } = await limiter.limit(key)
  return success
}
