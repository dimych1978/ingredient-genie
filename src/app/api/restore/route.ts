import { NextResponse } from 'next/server';

// Импортируем данные из JSON файла
import overridesData from '@/lib/forRedis.json';

// Функция для восстановления данных
async function restoreToRedis() {
  try {
    console.log('Начинаем восстановление overrides...');
    
    // Получаем URL и токен из переменных окружения
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    // Проверяем наличие переменных
    if (!redisUrl || !redisToken) {
      throw new Error('Не настроены переменные окружения Redis');
    }
    
    console.log(`Восстанавливаем ${Object.keys(overridesData).length} записей...`);
    
    // Отправляем данные в Redis через REST API
    const response = await fetch(`${redisUrl}/set/loading-overrides`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(overridesData),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Ошибка от Redis:', result);
      throw new Error(`Redis error: ${JSON.stringify(result)}`);
    }
    
    console.log('✅ Данные успешно восстановлены!');
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Обработчик GET запроса
export async function GET() {
  try {
    const result = await restoreToRedis();
    
    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Восстановлено ${Object.keys(overridesData).length} оверрайдов`
        : 'Ошибка при восстановлении',
      count: Object.keys(overridesData).length,
      details: result,
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Неизвестная ошибка',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}