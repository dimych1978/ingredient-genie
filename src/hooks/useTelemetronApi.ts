// hooks/useTelemetronApi.ts
import { useCallback } from "react";
import { format } from "date-fns"; // <-- меняем formatISO на format
import { TelemetronSalesResponse } from "@/types/telemetron";

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

// hooks/useTelemetronApi.ts - исправляем getPlanogram
const getPlanogram = useCallback(async (vmId: string): Promise<string[]> => {
  const cacheKey = `planogram-${vmId}`;

  
  
  // Проверяем кэш (24 часа для планограммы)
  // const cached = sessionStorage.getItem(cacheKey);
  // const cacheTime = sessionStorage.getItem(`${cacheKey}:time`);
  
  // if (cached && cacheTime && Date.now() - parseInt(cacheTime) < 24 * 60 * 60 * 1000) {
  //   console.log('Возвращаем кэшированную планограмму для', vmId);
  //   return JSON.parse(cached);
  // }
  
  // Загружаем данные для создания планограммы
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30); // Берем продажи за 7 дней
  
  console.log('Генерируем планограмму для аппарата', vmId);
  console.log('Период:', dateFrom, '-', dateTo);
  
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
    
    console.log('Сгенерированная планограмма:', planogram);
    console.log('Длина планограммы:', planogram.length);
    
    // Сохраняем в кэш
    // sessionStorage.setItem(cacheKey, JSON.stringify(planogram));
    // sessionStorage.setItem(`${cacheKey}:time`, Date.now().toString());
    
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
  
  // Ключевое исправление: сравниваем ВСЕ числовые части
  // 10, 11, 12... должны идти перед 1A, 1B
  // Сравниваем по числовой части
  if (aNum !== bNum) {
    // Если числовые части разные, сравниваем их
    return aNum - bNum;
  }
  
  const aSuffix = aMatch?.[2] || "";
  const bSuffix = bMatch?.[2] || "";
  
  // Если числовые части равны, то:
  // 1. Без суффикса идет перед с суффиксом
  if (aSuffix === "" && bSuffix !== "") return -1;  // "10" < "1A"
  if (aSuffix !== "" && bSuffix === "") return 1;   // "1A" > "10"
  
  // Оба с суффиксами: сортируем по алфавиту
  return aSuffix.localeCompare(bSuffix);
}

function generatePlanogramFromSalesData(salesData: TelemetronSalesResponse): string[] {
  console.log('=== generatePlanogramFromSalesData ===');
  
  if (!salesData.data || salesData.data.length === 0) return [];
  
  const validItems = salesData.data.filter(item => 
    item.product_number && item.planogram?.name
  );
  
  // Собираем существующие комбинации из API
  const existingCombinations = new Map<string, string>();
  
  validItems.forEach(item => {
    const key = `${item.product_number}.${item.planogram.name}`;
    const value = `${item.product_number}. ${item.planogram.name}`;
    existingCombinations.set(key, value);
  });
  
  // Генерируем полную планограмму: 10-19, 1A, 1B, 20-29, 2A, 2B, ..., 60-69
  const fullPlanogram: string[] = [];
  
  // Для каждой полки (1-6)
  for (let shelf = 1; shelf <= 6; shelf++) {
    // Цифровые ячейки: 10, 11, ..., 19
    for (let i = 0; i <= 9; i++) {
      const cellNum = shelf * 10 + i; // 10, 11, ..., 19
      const key = `${cellNum}`;
      const existing = existingCombinations.get(`${key}.${getItemNameByKey(existingCombinations, key)}`);
      
      if (existing) {
        fullPlanogram.push(existing);
      } else {
        fullPlanogram.push(`${key}. [Нет данных]`);
      }
    }
    
    // Буквенные ячейки: 1A, 1B
    const letters = ['A', 'B'];
    for (const letter of letters) {
      const key = `${shelf}${letter}`; // 1A, 1B
      const existing = existingCombinations.get(`${key}.${getItemNameByKey(existingCombinations, key)}`);
      
      if (existing) {
        fullPlanogram.push(existing);
      } else {
        fullPlanogram.push(`${key}. [Нет данных]`);
      }
    }
  }
  
  // Функция для получения названия по ключу
  function getItemNameByKey(map: Map<string, string>, key: string): string {
    for (const [mapKey, value] of map.entries()) {
      if (mapKey.startsWith(`${key}.`)) {
        const match = value.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
        return match ? match[2] : '';
      }
    }
    return '';
  }
  
  // Сортируем по naturalProductNumberSort
  const sorted = fullPlanogram.sort((a, b) => {
    const aMatch = a.match(/^(\d+)([A-Za-z]*?)\./);
    const bMatch = b.match(/^(\d+)([A-Za-z]*?)\./);
    const aNum = aMatch ? aMatch[0] : '';
    const bNum = bMatch ? bMatch[0] : '';
    return naturalProductNumberSort({ product_number: aNum }, { product_number: bNum });
  });
  
  console.log('Итоговая планограмма:', sorted.length);
  console.log('Первые 20 элементов:', sorted.slice(0, 20));
  
  return sorted;
}

  return {
    getMachineOverview,
    getSalesByProducts,
    apiRequest, 
    getPlanogram
  };
};