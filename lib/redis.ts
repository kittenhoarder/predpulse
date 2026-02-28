import { Redis } from "@upstash/redis";

// Singleton Redis client — safe for serverless (each invocation reuses the same instance)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
