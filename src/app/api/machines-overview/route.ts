// // src/app/api/machines-overview/route.ts
// import { NextRequest, NextResponse } from 'next/server';

// const TELEMETRON_BASE_URL = 'https://my.telemetron.net';

// export async function POST(request: NextRequest) {
//   try {
//     const url = `${TELEMETRON_BASE_URL}/api/machines-overview`;
//     console.log('🔄 Прокси на:', url);

//     const authHeader = request.headers.get('authorization');
//     if (!authHeader) {
//       return NextResponse.json({ error: 'No auth' }, { status: 401 });
//     }

//     const contentType = request.headers.get('content-type');
//     const headers: HeadersInit = { 'Authorization': authHeader, 'Accept': 'application/json' };
    
//     let body: BodyInit;
//     if (contentType?.includes('multipart/form-data')) {
//       body = await request.formData();
//     } else {
//       headers['Content-Type'] = contentType || 'application/json';
//       body = await request.text();
//     }

//     const response = await fetch(url, {
//       method: 'POST',
//       headers,
//       body,
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error('❌ Ошибка:', response.status, errorText.substring(0, 200));
//       return NextResponse.json(
//         { error: `Telemetron error: ${response.status}` },
//         { status: response.status }
//       );
//     }

//     const data = await response.json();
//     console.log('✅ Успех');
//     return NextResponse.json(data);

//   } catch (error) {
//     console.error('❌ Прокси ошибка:', error);
//     return NextResponse.json({ error: 'Internal error' }, { status: 500 });
//   }
// }