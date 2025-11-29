// app/api/telemetron/debug/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Простой тест чтобы проверить что прокси работает
  return NextResponse.json({
    message: 'Прокси работает!',
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(request.headers.entries())
  });
}