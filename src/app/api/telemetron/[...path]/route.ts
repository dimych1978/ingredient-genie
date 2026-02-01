//api/telemetron/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TELEMETRON_BASE_URL = 'https://my.telemetron.net';

// Конфигурация OAuth 2.0 для Telemetron
const TELEMETRON_CLIENT_ID = '95d753e0-39d1-4dfb-9886-8cda193d4aa9';
const TELEMETRON_CLIENT_SECRET = 'sh1LBRJRqWjeoojiTzxl3XdKOfjyoqCMcuiZQNkU';

// Кэш для токена (живет только во время выполнения функции)
let tokenCache: { token: string; expiry: number } | null = null;

// Функция для получения Bearer токена от Telemetron
async function getTelemetronToken(): Promise<string> {
  const username = process.env.TELEMETRON_USERNAME;
  const password = process.env.TELEMETRON_PASSWORD;

  if (!username || !password) {
    console.error('Telemetron credentials missing in environment');
    throw new Error('Telemetron credentials not configured');
  }

  // Проверяем кэш (токены обычно живут 1-2 часа, проверяем за минуту до истечения)
  if (tokenCache && Date.now() < tokenCache.expiry - 60000) {
    console.log('Using cached token');
    return tokenCache.token;
  }

  console.log('Requesting new token from Telemetron...');

  try {
    const tokenResponse = await fetch(`${TELEMETRON_BASE_URL}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Token-Applicant': 'site',
      },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: TELEMETRON_CLIENT_ID,
        client_secret: TELEMETRON_CLIENT_SECRET,
        username: username,
        password: password,
        scope: '',
        lang: 'ru',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token request failed:', tokenResponse.status, errorText);
      throw new Error(
        `Token request failed: ${tokenResponse.status} - ${errorText}`
      );
    }

    const tokenData = await tokenResponse.json();

    // Сохраняем в кэш
    tokenCache = {
      token: tokenData.access_token,
      expiry: Date.now() + tokenData.expires_in * 1000,
    };

    console.log(
      'Token obtained successfully, expires in:',
      tokenData.expires_in,
      'seconds'
    );
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting Telemetron token:', error);
    throw error;
  }
}

// Общая функция для обработки запросов
async function handleTelemetronRequest(
  method: 'GET' | 'POST',
  request: NextRequest,
  params: Promise<{ path: string[] }>
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${TELEMETRON_BASE_URL}/api/${path}${
      searchParams ? `?${searchParams}` : ''
    }`;

    console.log(`Proxying ${method} request to: ${url}`);

    // Получаем Bearer токен
    const token = await getTelemetronToken();
    // console.log("🚀 ~ handleTelemetronRequest ~ token:", token)

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    let body: BodyInit | undefined;

    if (method === 'POST') {
      const contentType = request.headers.get('content-type');
      console.log('Content-Type received:', contentType);

      // Обработка FormData
      if (contentType?.includes('multipart/form-data')) {
        const formData = await request.formData();
        body = formData;
        // Для FormData НЕ добавляем Content-Type заголовок!
        // fetch API сам установит правильный boundary
      } else {
        // Для JSON или других типов
        headers['Content-Type'] = contentType || 'application/json';
        const textBody = await request.text();
        body = textBody;
      }
    } else {
      // Для GET запросов
      headers['Content-Type'] = 'application/json';
    }

    console.log('Sending request with headers:', Object.keys(headers));

    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Не удалось прочитать тело ошибки';
      }

      console.error(
        `Telemetron API error ${response.status}:`,
        errorBody.substring(0, 200)
      );

      return NextResponse.json(
        {
          error: `Telemetron API error: ${response.status} ${response.statusText}`,
          details: errorBody.substring(0, 500),
        },
        { status: response.status }
      );
    }

    // Читаем ответ как текст
    const responseText = await response.text();
    const contentType = response.headers.get('content-type');

    // Если это HTML, пытаемся извлечь JSON
    if (contentType?.includes('text/html')) {
      try {
        // Пытаемся найти JSON в HTML
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonString = jsonMatch[0];
          const data = JSON.parse(jsonString);
          return NextResponse.json(data);
        } else {
          return NextResponse.json(
            {
              message: 'HTML response without JSON',
              contentType: contentType,
              body: responseText.substring(0, 1000),
            },
            { status: 200 }
          );
        }
      } catch (parseError) {
        return NextResponse.json(
          {
            error: 'Failed to parse JSON from HTML response',
            contentType: contentType,
            body: responseText.substring(0, 1000),
          },
          { status: 500 }
        );
      }
    }

    // Если это JSON, парсим как обычно
    if (contentType?.includes('application/json')) {
      try {
        const data = JSON.parse(responseText);
        return NextResponse.json(data);
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Failed to parse JSON response' },
          { status: 500 }
        );
      }
    }

    // Если другой content-type
    return NextResponse.json(
      {
        message: 'Unknown response format',
        contentType: contentType,
        body: responseText.substring(0, 1000),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Proxy internal error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error in proxy',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleTelemetronRequest('GET', request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleTelemetronRequest('POST', request, params);
}
