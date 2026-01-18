// hooks/usePlanogramData.ts
import { useCallback } from 'react';
import { format } from 'date-fns';
import {
  TelemetronSaleItem,
  TelemetronSalesResponse,
} from '@/types/telemetron';
import {
  getSavedPlanogram,
  getLastTelemetronPress,
  getLastSaveTime,
} from '@/app/actions';
import { useTelemetronApi } from './useTelemetronApi';
import {
  allMachines,
  getMachineType,
  machineIngredients,
  planogramsHardCode,
} from '@/lib/data';

export type PlanogramData = {
  planogram: string[]; // Отсортированные строки планограммы
  salesThisPeriod: Map<string, number>; // Продажи за "этот период" по ячейкам
  lastActionDate: string | null; // Дата последнего сохранения/нажатия
  isLoading: boolean;
  error: string | null;
  coffeeProductNumbers: string[];
  isSavedPlanogram: boolean;
};

export const usePlanogramData = () => {
  const { getSalesByProducts } = useTelemetronApi();

  const loadPlanogramData = useCallback(
    async (vmId: string): Promise<PlanogramData> => {
      console.log('=== usePlanogramData.loadPlanogramData для аппарата', vmId);

      const machine = allMachines.find(m => m.id === vmId);
      const machineType = machine ? getMachineType(machine) : 'snack';

      console.log('🚀 ~ usePlanogramData ~ machineType:', machineType);
      if (machineType === 'bottle') {
        console.log(
          'Используем захардкоженную планограмму для бутылочного аппарата'
        );

        return {
          planogram: planogramsHardCode.bottle.map(
            (item, index) => `${index + 1}. ${item}`
          ),
          coffeeProductNumbers: [], // Бутылочные аппараты не имеют кофейных напитков
          salesThisPeriod: new Map(),
          lastActionDate: null,
          isLoading: false,
          error: null,
          isSavedPlanogram: false,
        };
      }

      // 1. Получаем сохраненную планограмму
      const savedPlanogram = await getSavedPlanogram(vmId);
      if (savedPlanogram && Object.keys(savedPlanogram).length > 0) {
        console.log('Используем сохраненную планограмму из Redis');

        const planogramArray = Object.entries(savedPlanogram).map(
          ([productNumber, name]) => `${productNumber}. ${name}`
        );
        console.log('🚀 ~ usePlanogramData ~ planogramArray:', planogramArray);

        // const sorted = sortPlanogram(planogramArray);

        return {
          planogram: planogramArray,
          coffeeProductNumbers: [],
          salesThisPeriod: new Map(),
          lastActionDate: null,
          isLoading: false,
          error: null,
          isSavedPlanogram: true,
        };
      }

      // 2. Получаем дату последнего действия ("этот период")
      let lastActionDate = await getLastTelemetronPress(vmId);
      if (!lastActionDate) {
        lastActionDate = await getLastSaveTime(vmId);
      }

      console.log('Дата последнего действия ("этот период"):', lastActionDate);

      // 3. Загружаем продажи за "этот период" (от lastActionDate до сейчас)
      const salesThisPeriod = new Map<string, number>();

      if (lastActionDate) {
        try {
          const salesThisPeriodData = await getSalesByProducts(
            vmId,
            format(new Date(lastActionDate), 'yyyy-MM-dd HH:mm:ss'),
            format(new Date(), 'yyyy-MM-dd HH:mm:ss')
          );

          if (salesThisPeriodData?.data) {
            salesThisPeriodData.data.forEach((item: TelemetronSaleItem) => {
              if (!item.product_number) return;
              const key = item.product_number;
              const current = salesThisPeriod.get(key) || 0;
              salesThisPeriod.set(key, current + item.number);
            });
          }
        } catch (error) {
          console.error('Ошибка загрузки продаж за "этот период":', error);
        }
      }

      // 4. Загружаем продажи за 30 дней (период планограммы)
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 365);

      let salesData: TelemetronSalesResponse;
      try {
        salesData = await getSalesByProducts(
          vmId,
          format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
          format(dateTo, 'yyyy-MM-dd HH:mm:ss')
        );
      } catch (error) {
        console.error('Ошибка загрузки продаж за период планограммы:', error);
        return {
          planogram: [],
          coffeeProductNumbers: [],
          salesThisPeriod,
          lastActionDate,
          isLoading: false,
          error: 'Ошибка загрузки данных продаж',
          isSavedPlanogram: false,
        };
      }

      if (!salesData?.data || salesData.data.length === 0) {
        return {
          planogram: [],
          coffeeProductNumbers: [],
          salesThisPeriod,
          lastActionDate,
          isLoading: false,
          error: null,
          isSavedPlanogram: false,
        };
      }

      // 5. Генерируем планограмму с учетом продаж за "этот период"
      const { planogram, coffeeProductNumbers } =
        generatePlanogramFromSalesData(salesData, salesThisPeriod);

      return {
        planogram,
        coffeeProductNumbers,
        salesThisPeriod,
        lastActionDate,
        isLoading: false,
        error: null,
        isSavedPlanogram: false,
      };
    },
    [getSalesByProducts]
  );

  return { loadPlanogramData };
};

// Функции сортировки и генерации
function sortPlanogram(planogram: string[]): string[] {
  return planogram.sort((a, b) => {
    // const aMatch = a.match(/^(\d+)([A-Za-z]*?)\./);
    // const bMatch = b.match(/^(\d+)([A-Za-z]*?)\./);
    const aMatch = a.match(/^(\d+)([A-Za-z]*?)/);
    const bMatch = b.match(/^(\d+)([A-Za-z]*?)/);
    const aNum = aMatch ? aMatch[0] : '';
    const bNum = bMatch ? bMatch[0] : '';
    return naturalProductNumberSort(
      { product_number: aNum },
      { product_number: bNum }
    );
  });
}

function naturalProductNumberSort(
  a: { product_number: string },
  b: { product_number: string }
) {
  // const aMatch = a.product_number.match(/^(\d+)([A-Za-z]*)$/);
  // const bMatch = b.product_number.match(/^(\d+)([A-Za-z]*)$/);
  const aMatch = a.product_number.match(/^(\d+)([A-Za-z]*)$/);
  const bMatch = b.product_number.match(/^(\d+)([A-Za-z]*)$/);
  const aNum = parseInt(aMatch?.[1] || '0');
  const bNum = parseInt(bMatch?.[1] || '0');

  if (aNum !== bNum) {
    return aNum - bNum;
  }

  const aSuffix = aMatch?.[2] || '';
  const bSuffix = bMatch?.[2] || '';

  if (aSuffix === '' && bSuffix !== '') return -1;
  if (aSuffix !== '' && bSuffix === '') return 1;

  return aSuffix.localeCompare(bSuffix);
}

function generatePlanogramFromSalesData(
  salesData: TelemetronSalesResponse,
  salesThisPeriod: Map<string, number>
): { planogram: string[]; coffeeProductNumbers: string[] } {
  console.log('=== generatePlanogramFromSalesData ===');

  const coffeeProductNumbers = new Set<string>();
  console.log(
    '🚀 ~ generatePlanogramFromSalesData ~ coffeeProductNumbers:',
    coffeeProductNumbers
  );

  const allAA = salesData.data.every(item => item.product_number === 'AA');

if (allAA) {
  // 1. Ищем запись с максимальным id (самая свежая)
  let bestName = 'Товар';
  let maxId = -1;
  
  salesData.data.forEach(item => {
    const id = item.planogram?.id;
    if (id && id > maxId) {
      maxId = id;
      bestName = item.planogram.name;
    }
  });
  
  // 2. Если все id = null, берем самое продаваемое название
  if (maxId === -1) {
    const salesByName = new Map<string, number>();
    salesData.data.forEach(item => {
      const name = item.planogram?.name;
      if (name) {
        salesByName.set(name, (salesByName.get(name) || 0) + item.number);
      }
    });
    
    let maxSales = 0;
    salesByName.forEach((sales, name) => {
      if (sales > maxSales) {
        maxSales = sales;
        bestName = name;
      }
    });
  }
  
  return {
    planogram: [`AA. ${bestName}`],
    coffeeProductNumbers: [],
  };
}
  // 1. Собираем все записи
  const itemsByProductNumber = new Map<
    string,
    Array<{
      originalName: string;
      totalSales: number;
    }>
  >();

  salesData.data.forEach(item => {
    if (!item.product_number || !item.planogram?.name) return;

    // Запоминаем кофейные напитки
    const hasIngredients =
      item.planogram.ingredients && item.planogram.ingredients.length > 0;
    console.log(
      `${item.product_number}. ${item.planogram.name}: ingredients?`,
      hasIngredients
    );

    if (hasIngredients) {
      coffeeProductNumbers.add(item.product_number);
    }

    const productNumber = item.product_number;
    const originalName = item.planogram.name;

    // Фильтрация мусора
    if (
      originalName === 'пр' ||
      (originalName.toLowerCase().includes('нет данных') &&
        item.planogram?.price === 0)
    )
      return;

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
        totalSales: item.number,
      });
    }
  });

  // 2. Выбираем лучший вариант с учетом продаж за "этот период"
  const bestNames = new Map<string, string>();

  itemsByProductNumber.forEach((items, productNumber) => {
    if (items.length === 0) return;

    if (items.length === 1) {
      bestNames.set(productNumber, items[0].originalName);
      return;
    }

    // Проверяем продажи за "этот период" для каждого варианта
    // Ищем вариант, у которого есть продажи в salesThisPeriod
    let bestItem = null;

    for (const item of items) {
      const salesInThisPeriod = salesThisPeriod.get(productNumber) || 0;
      if (salesInThisPeriod > 0) {
        bestItem = item;
        break;
      }
    }

    if (bestItem) {
      bestNames.set(productNumber, bestItem.originalName);
    } else {
      // Нет продаж за "этот период", берем первый вариант
      bestNames.set(productNumber, items[0].originalName);
    }
  });

  // 3. Генерируем полную планограмму (72 ячейки)
  const fullPlanogram: string[] = [];

  for (let shelf = 1; shelf <= 6; shelf++) {
    for (let i = 0; i <= 9; i++) {
      const cellNum = shelf * 10 + i;
      const key = `${cellNum}`;
      const bestName = bestNames.get(key);
      if (bestName) fullPlanogram.push(`${key}. ${bestName}`);
    }

    const letters = ['A', 'B'];
    for (const letter of letters) {
      const key = `${shelf}${letter}`;
      const bestName = bestNames.get(key);
      if (bestName) fullPlanogram.push(`${key}. ${bestName}`);
    }
  }

  // 4. Сортируем
  const sorted = sortPlanogram(fullPlanogram);
  console.log('Итоговая планограмма:', sorted.length, 'элементов');
  console.log('Кофейные productNumbers:', Array.from(coffeeProductNumbers));

  return {
    planogram: sorted,
    coffeeProductNumbers: Array.from(coffeeProductNumbers),
  };
}
