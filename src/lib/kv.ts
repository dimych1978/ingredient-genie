// lib/kv.ts - для Upstash 
import { Redis } from '@upstash/redis';

// Создаем клиент из переменных окружения.
// Метод fromEnv() ищет UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN
export const kv = Redis.fromEnv();
console.log('Redis Config:', {
  url: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30) + '...',
  hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  env: process.env.VERCEL_ENV,
  branch: process.env.VERCEL_GIT_COMMIT_REF
});