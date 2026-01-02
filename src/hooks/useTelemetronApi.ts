// hooks/useTelemetronApi.ts
import { useCallback } from "react";
import { format } from "date-fns";
import { TelemetronSalesResponse } from "@/types/telemetron";
import { getSavedPlanogram } from "@/app/actions"; // Добавляем импорт

export const useTelemetronApi = () => {
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
     const cacheKey = `${endpoint}:${JSON.stringify(options.body || '')}`;
  
  // Проверяем кэш (5 минут)
  const cached = sessionStorage.getItem(cacheKey);
  const cacheTime = sessionStorage.getItem(`${cacheKey}:time`);
  
  if (cached && cacheTime && Date.now() - parseInt(cacheTime) < 5 * 60 * 1000) {
    return JSON.parse(cached);
  }
  
    const response = await fetch(`/api/telemetron/${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status}. ${errorText}`);
    }

    return response.json();
  }, []);

  const getMachineOverview = useCallback((vmId: string) => {
    const formData = new FormData();
    formData.append('_method', 'get');
    formData.append('data[id]', vmId);

    return apiRequest(`machines-overview`, {
      method: 'POST',
      body: formData
    });
  }, [apiRequest]);

  const getSalesByProducts = useCallback((vmId: string, dateFrom: string, dateTo: string) => {
    // Telemetron API ожидает даты в формате "YYYY-MM-DD HH:MM:SS" или "YYYY-MM-DD"
    return apiRequest(
      `reports/sales-by-products?vm_id=${vmId}&sale_type=4&date_from=${dateFrom}&date_to=${dateTo}`
    );
  }, [apiRequest]);

// Обновленная функция getPlanogram
const getPlanogram = useCallback(async (vmId: string): Promise<string[]> => {
  const cacheKey = `planogram-${vmId}`;
  
  // 1. Пытаемся получить сохраненную планограмму из Redis
  const savedPlanogram = await getSavedPlanogram(vmId);
  if (savedPlanogram && Object.keys(savedPlanogram).length > 0) {
    console.log('Используем сохраненную планограмму из Redis для аппарата', vmId);
    
    // Преобразуем объект в массив строк
    const planogramArray = Object.entries(savedPlanogram)
      .map(([productNumber, name]) => `${productNumber}. ${name}`);
    
    // Сортируем по naturalProductNumberSort
    const sorted = planogramArray.sort((a, b) => {
      const aMatch = a.match(/^(\d+)([A-Za-z]*?)\./);
      const bMatch = b.match(/^(\d+)([A-Za-z]*?)\./);
      const aNum = aMatch ? aMatch[0] : '';
      const bNum = bMatch ? bMatch[0] : '';
      return naturalProductNumberSort({ product_number: aNum }, { product_number: bNum });
    });
    
    return sorted;
  }
  
  console.log('Сохраненной планограммы нет, генерируем из данных продаж для аппарата', vmId);
  
  // Загружаем данные для создания планограммы
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30); // Берем продажи за 30 дней
  
  try {
    const salesData: TelemetronSalesResponse = await getSalesByProducts(
      vmId,
      format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
      format(dateTo, 'yyyy-MM-dd HH:mm:ss')
    );
    
    console.log('Данные для планограммы получены:', salesData);
    console.log('Количество элементов в salesData.data:', salesData?.data?.length);
    
    if (!salesData?.data || salesData.data.length === 0) {
      console.log('Нет данных продаж для генерации планограммы');
      return [];
    }
    
    // Генерируем планограмму из данных
    const planogram = generatePlanogramFromSalesData(salesData);
    
    console.log('Сгенерированная планограмма:', planogram.length, 'элементов');
    
    return planogram;
  } catch (error) {
    console.error('Ошибка генерации планограммы для аппарата', vmId, ':', error);
    return []; // Возвращаем пустую планограмму при ошибке
  }
}, [getSalesByProducts]);

function naturalProductNumberSort(a: {product_number: string}, b: {product_number: string}) {
  const aMatch = a.product_number.match(/^(\d+)([A-Za-z]*)$/);
  const bMatch = b.product_number.match(/^(\d+)([A-Za-z]*)$/);
  
  const aNum = parseInt(aMatch?.[1] || "0");
  const bNum = parseInt(bMatch?.[1] || "0");
  
  if (aNum !== bNum) {
    return aNum - bNum;
  }
  
  const aSuffix = aMatch?.[2] || "";
  const bSuffix = bMatch?.[2] || "";
  
  if (aSuffix === "" && bSuffix !== "") return -1;
  if (aSuffix !== "" && bSuffix === "") return 1;
  
  return aSuffix.localeCompare(bSuffix);
}

function normalizeName(name: string): string {
  // Убираем лишние пробелы в начале/конце
  // Убираем точку в конце, если она есть
  return name
    .trim()
    .replace(/\.+$/, '') // Убираем точку в конце
    .replace(/\s+/g, ' '); // Заменяем множественные пробелы на один
}

function generatePlanogramFromSalesData(salesData: TelemetronSalesResponse): string[] {
  console.log('=== generatePlanogramFromSalesData ===');
  
  if (!salesData.data || salesData.data.length === 0) return [];
  
  // 1. Собираем все записи, применяем .trim() к именам
  const itemsByProductNumber = new Map<string, Array<{
    originalName: string;
    totalSales: number;
  }>>();
  
  salesData.data.forEach(item => {
    if (!item.product_number || !item.planogram?.name) return;
    
    const productNumber = item.product_number;
    const originalName = item.planogram.name.trim();
    
    // Пропускаем "пр"
    if (originalName === "пр") {
      return;
    }
    
    if (!itemsByProductNumber.has(productNumber)) {
      itemsByProductNumber.set(productNumber, []);
    }
    
    const items = itemsByProductNumber.get(productNumber)!;
    const existingItem = items.find(i => i.originalName === originalName);
    
    if (existingItem) {
      existingItem.totalSales += item.number;
    } else {
      items.push({
        originalName: originalName,
        totalSales: item.number
      });
    }
  });
  
  // 2. Выбираем лучший вариант для каждого productNumber
  const bestNames = new Map<string, string>();
  
  itemsByProductNumber.forEach((items, productNumber) => {
    if (items.length === 0) return;
    
    // Берем любой вариант (все имена одинаковые после .trim())
    bestNames.set(productNumber, items[0].originalName);
  });
  
  // 3. Генерируем полную планограмму из 72 ячеек
  const fullPlanogram: string[] = [];
  
  // Для каждой полки (1-6)
  for (let shelf = 1; shelf <= 6; shelf++) {
    // Цифровые ячейки: 10, 11, ..., 19
    for (let i = 0; i <= 9; i++) {
      const cellNum = shelf * 10 + i; // 10, 11, ..., 19
      const key = `${cellNum}`;
      
      const bestName = bestNames.get(key);
      if (bestName) {
        fullPlanogram.push(`${key}. ${bestName}`);
      } else {
        // Не добавляем "[Нет данных]" - пропускаем пустые ячейки
      }
    }
    
    // Буквенные ячейки: 1A, 1B
    const letters = ['A', 'B'];
    for (const letter of letters) {
      const key = `${shelf}${letter}`; // 1A, 1B
      
      const bestName = bestNames.get(key);
      if (bestName) {
        fullPlanogram.push(`${key}. ${bestName}`);
      } else {
        // Не добавляем "[Нет данных]" - пропускаем пустые ячейки
      }
    }
  }
  
  // 4. Сортируем полную планограмму
  const sorted = fullPlanogram.sort((a, b) => {
    const aMatch = a.match(/^(\d+)([A-Za-z]*?)\./);
    const bMatch = b.match(/^(\d+)([A-Za-z]*?)\./);
    const aNum = aMatch ? aMatch[0] : '';
    const bNum = bMatch ? bMatch[0] : '';
    return naturalProductNumberSort({ product_number: aNum }, { product_number: bNum });
  });
  
  console.log('Итоговая планограмма:', sorted.length, 'элементов из возможных 72');
  console.log('Сортировка:', sorted.slice(0, 10));
  return sorted;
}

return {
    getMachineOverview,
    getSalesByProducts,
    apiRequest, 
    getPlanogram
  };
};