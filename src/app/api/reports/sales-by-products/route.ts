// // src/app/api/reports/sales-by-products/route.ts
// import { NextRequest, NextResponse } from 'next/server';

// const TELEMETRON_BASE_URL = 'https://my.telemetron.net';

// export async function GET(request: NextRequest) {
//   try {
//     const searchParams = request.nextUrl.searchParams.toString();
//     const url = `${TELEMETRON_BASE_URL}/api/reports/sales-by-products?${searchParams}`;
    
//     console.log('🔄 GET sales-by-products к:', url);

//     const authHeader = request.headers.get('authorization');
//     if (!authHeader) {
//       return NextResponse.json({ error: 'No auth' }, { status: 401 });
//     }

//     const response = await fetch(url, {
//       method: 'GET',
//       headers: {
//         'Authorization': authHeader,
//         'Accept': 'application/json',
//       },
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
//     console.log('✅ Успех sales-by-products');
//     return NextResponse.json(data);

//   } catch (error) {
//     console.error('❌ Прокси ошибка:', error);
//     return NextResponse.json({ error: 'Internal error' }, { status: 500 });
//   }
// }