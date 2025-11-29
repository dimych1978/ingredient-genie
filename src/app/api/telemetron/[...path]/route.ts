// app/api/telemetron/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TELEMETRON_BASE_URL = 'https://my.telemetron.net';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    
    // Собираем полный URL
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${TELEMETRON_BASE_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;
    
    console.log('🔄 Прокси запрос к:', url);

    // Получаем токен из заголовков
    const authHeader = request.headers.get('authorization');
    
    console.log('🔑 Authorization header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header provided' },
        { status: 401 }
      );
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    console.log('📡 Ответ от Telemetron:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка Telemetron:', response.status, errorText);
      return NextResponse.json(
        { 
          error: `Telemetron API error: ${response.status}`,
          url: url,
          details: errorText.substring(0, 500) 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Успех! Данные получены');
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Прокси ошибка:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}