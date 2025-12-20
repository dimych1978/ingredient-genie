// lib/kv.ts - для Upstash (исправленная версия)
import { Redis } from '@upstash/redis';

// Просто создаем клиент из переменных окружения.
// Метод fromEnv() ищет UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN
export const kv = Redis.fromEnv();