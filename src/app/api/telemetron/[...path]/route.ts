// app/api/telemetron/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TELEMETRON_BASE_URL = 'https://my.telemetron.net';

// app/api/telemetron/[...path]/route.ts
// Обновим обработку ответов

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${TELEMETRON_BASE_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;
    
    console.log('🔄 Прокси запрос к:', url);

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

    console.log('📡 Ответ от Telemetron:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      url: url
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Не удалось прочитать тело ошибки';
      }

      console.error('❌ Ошибка от Telemetron:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody.substring(0, 500)
      });

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
      console.log('⚠️ Ответ в HTML формате, пытаемся извлечь JSON...');
      
      try {
        // Пытаемся найти JSON в HTML
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonString = jsonMatch[0];
          const data = JSON.parse(jsonString);
          console.log('✅ JSON извлечен из HTML');
          return NextResponse.json(data);
        } else {
          console.log('❌ Не удалось найти JSON в HTML');
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
        console.error('❌ Ошибка парсинга JSON из HTML:', parseError);
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
        console.log('✅ JSON данные получены');
        return NextResponse.json(data);
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse JSON response' },
          { status: 500 }
        );
      }
    }

    // Если другой content-type
    console.log('⚠️ Неизвестный content-type:', contentType);
    return NextResponse.json(
      { 
        message: 'Unknown response format',
        contentType: contentType,
        body: responseText.substring(0, 1000)
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Прокси ошибка:', error);
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
    
    console.log('🔄 POST прокси запрос к:', url);

    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header provided' },
        { status: 401 }
      );
    }

    // Получаем заголовки исходного запроса
    const headers: HeadersInit = {
      'Authorization': authHeader,
    };

    // Переносим все заголовки кроме Host
    request.headers.forEach((value, key) => {
      if (key !== 'host') {
        headers[key] = value;
      }
    });

    // Получаем тело запроса как есть
    const requestBody = await request.blob();

    console.log('📡 Отправляем POST с заголовками:', headers);

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: requestBody,
    });

    console.log('📡 POST ответ от Telemetron:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      url: url
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Не удалось прочитать тело ошибки';
      }

      console.error('❌ POST ошибка Telemetron:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody.substring(0, 500)
      });

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

    // Если это HTML, пытаемся извлечь JSON (как в GET обработчике)
    if (contentType?.includes('text/html')) {
      console.log('⚠️ Ответ в HTML формате, пытаемся извлечь JSON...');
      
      try {
        // Пытаемся найти JSON в HTML
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonString = jsonMatch[0];
          const data = JSON.parse(jsonString);
          console.log('✅ JSON извлечен из HTML');
          return NextResponse.json(data);
        } else {
          console.log('❌ Не удалось найти JSON в HTML');
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
        console.error('❌ Ошибка парсинга JSON из HTML:', parseError);
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
        console.log('✅ JSON данные получены');
        return NextResponse.json(data);
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse JSON response' },
          { status: 500 }
        );
      }
    }

    // Если другой content-type
    console.log('⚠️ Неизвестный content-type:', contentType);
    return NextResponse.json(
      { 
        message: 'Unknown response format',
        contentType: contentType,
        body: responseText.substring(0, 1000)
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ POST прокси ошибка:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error in proxy', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}