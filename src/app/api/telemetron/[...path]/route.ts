// app/api/telemetron/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TELEMETRON_BASE_URL = 'https://my.telemetron.net';

// app/api/telemetron/[...path]/route.ts
// Обновим обработку ответов

export async function GET(
  request: NextRequest,
  { params }: { params: Promise <{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${TELEMETRON_BASE_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header provided' },
        { status: 401 }
      );
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Не удалось прочитать тело ошибки';
      }
      return NextResponse.json(
        { 
          error: `Telemetron API error: ${response.status} ${response.statusText}`,
          details: errorBody.substring(0, 500)
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
              body: responseText.substring(0, 1000)
            },
            { status: 200 }
          );
        }
      } catch (parseError) {
        return NextResponse.json(
          { 
            error: 'Failed to parse JSON from HTML response',
            contentType: contentType,
            body: responseText.substring(0, 1000)
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
        body: responseText.substring(0, 1000)
      },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error in proxy', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
// app/api/telemetron/[...path]/route.ts
// Добавьте этот код к существующему

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${TELEMETRON_BASE_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;
    
    const authHeader = request.headers.get('authorization');
    const contentType = request.headers.get('content-type');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header provided' },
        { status: 401 }
      );
    }

    // Подготавливаем заголовки
    const headers: HeadersInit = {
      'Authorization': authHeader,
      'Accept': 'application/json',
    };

    let body: BodyInit;
    
    // Обработка FormData
    if (contentType?.includes('multipart/form-data')) {
      // Для FormData получаем как FormData
      const formData = await request.formData();
      body = formData;
      // Не добавляем Content-Type - браузер сам установит boundary
    } else {
      // Для JSON и других типов
      headers['Content-Type'] = contentType || 'application/json';
      const textBody = await request.text();
      body = textBody;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: `Telemetron API error: ${response.status}`,
          details: errorText.substring(0, 500) 
        },
        { status: response.status }
      );
    }

    // Обработка ответа
    const responseText = await response.text();
    const responseContentType = response.headers.get('content-type');
    
    // Пробуем распарсить как JSON
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      // Если не JSON, пробуем извлечь JSON из HTML
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonString = jsonMatch[0];
          const data = JSON.parse(jsonString);
          return NextResponse.json(data);
        }
      } catch (error) {
        // не удалось извлечь
      }
      
      return NextResponse.json({ 
        message: 'Response is not JSON',
        contentType: responseContentType,
        rawResponse: responseText.substring(0, 1000) 
      });
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
