// hooks/usePlanogramData.ts
import { useCallback } from 'react';
import { format } from 'date-fns';
import {
  TelemetronSaleItem,
  TelemetronSalesResponse,
} from '@/types/telemetron';
import {
  getLastTelemetronPress,
  getLastSaveTime,
} from '@/app/actions';
import { useTelemetronApi } from './useTelemetronApi';
import { allMachines, getMachineType, planogramsHardCode } from '@/lib/data';

export type PlanogramData = {
  planogram: string[];
  salesThisPeriod: Map<string, number>;
  lastActionDate: string | null;
  isLoading: boolean;
  error: string | null;
  coffeeProductNumbers: string[];
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
          coffeeProductNumbers: [],
          salesThisPeriod: new Map(),
          lastActionDate: null,
          isLoading: false,
          error: null,
        };
      }

      // 1. Получаем дату последнего действия ("этот период")
      let lastActionDate = await getLastTelemetronPress(vmId);
      if (!lastActionDate) {
        lastActionDate = await getLastSaveTime(vmId);
      }

      console.log('Дата последнего действия ("этот период"):', lastActionDate);

      // 2. Загружаем продажи за "этот период" (от lastActionDate до сейчас)
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

      // 3. Загружаем продажи за 30 дней (период планограммы)
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);

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
        };
      }

      // 4. Проверка для кофейных аппаратов
      if (machineType === 'coffee') {
        const hasSnackSales = salesData.data.some(
          item =>
            !item.planogram?.ingredients ||
            item.planogram.ingredients.length === 0
        );
        console.log('🚀 ~ usePlanogramData ~ hasSnackSales:', hasSnackSales);

        if (!hasSnackSales) {
          console.log(
            'Неспаренный кофейный аппарат - возвращаем пустую планограмму'
          );
          return {
            planogram: [],
            coffeeProductNumbers: [],
            salesThisPeriod,
            lastActionDate,
            isLoading: false,
            error: null,
          };
        } else {
          salesData.data = salesData.data.filter(
            item =>
              !item.planogram?.ingredients ||
              item.planogram.ingredients.length === 0
          );
          const { planogram, coffeeProductNumbers } =
            generatePlanogramFromSalesData(salesData, salesThisPeriod);
          console.log(
            '🚀 ~ usePlanogramData ~ planogram with coffee:',
            planogram
          );

          return {
            planogram,
            coffeeProductNumbers,
            salesThisPeriod,
            lastActionDate,
            isLoading: false,
            error: null,
          };
        }
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
      };
    },
    [getSalesByProducts]
  );

  return { loadPlanogramData };
};

// Функции сортировки и генерации
export function sortPlanogramStrings(planogram: string[]): string[] {
  const parse = (str: string) => {
    // Извлекаем номер из строки "01. Название" или "1A. Название" или "10. Название"
    const match = str.match(/^(\d+[A-Za-z]?)\./);
    if (!match) {
      return { shelf: 0, type: 3, suffix: '', mainNum: 0, original: str };
    }

    const num = match[1];
    const numMatch = num.match(/^(\d+)([A-Za-z]*)$/);
    if (!numMatch) {
      return { shelf: 0, type: 3, suffix: '', mainNum: 0, original: str };
    }

    const mainNum = parseInt(numMatch[1], 10);
    const suffix = numMatch[2];

    // ОПРЕДЕЛЕНИЕ ПОЛКИ: по первой цифре
    let shelf: number;

    if (suffix === '') {
      // Для цифровых номеров:
      if (mainNum >= 1 && mainNum <= 9) {
        shelf = 0; // полка 0: 01-09
      } else {
        shelf = Math.floor(mainNum / 10); // полка: первая цифра
      }
    } else {
      // Для буквенных номеров: полка = первая цифра
      shelf = Math.floor(mainNum);
    }

    // ОПРЕДЕЛЕНИЕ ТИПА:
    // 0 = цифры 1-9 (полка 0)
    // 1 = десятки (10-19, 20-29, ...) - цифровые номера на полках 1-6
    // 2 = буквенные номера (1A, 1B, 2A, 2B, ...)
    let type: number;

    if (suffix === '') {
      if (mainNum >= 1 && mainNum <= 9) {
        type = 0; // 01-09
      } else {
        type = 1; // 10-19, 20-29, ...
      }
    } else {
      type = 2; // буквенные
    }

    return {
      shelf,
      type,
      suffix,
      mainNum,
      original: str,
    };
  };

  return planogram.sort((a, b) => {
    const A = parse(a);
    const B = parse(b);

    // 1. Сначала по полке (0, 1, 2...)
    if (A.shelf !== B.shelf) {
      return A.shelf - B.shelf;
    }

    // 2. Внутри полки: сначала цифры (type=0 или 1), потом буквенные (type=2)
    if (A.type !== B.type) {
      return A.type - B.type;
    }

    // 3. Для одинакового типа сортируем по основному числу
    if (A.type === 0 || A.type === 1) {
      // Для цифровых: по числу
      return A.mainNum - B.mainNum;
    } else {
      // Для буквенных: по числу, потом по суффиксу
      if (A.mainNum !== B.mainNum) {
        return A.mainNum - B.mainNum;
      }
      return A.suffix.localeCompare(B.suffix);
    }
  });
}

function generatePlanogramFromSalesData(
  salesData: TelemetronSalesResponse,
  salesThisPeriod: Map<string, number>
): { planogram: string[]; coffeeProductNumbers: string[] } {
  console.log('=== generatePlanogramFromSalesData ===');

  const coffeeProductNumbers = new Set<string>();

  const allAA = salesData.data.some(item => item.product_number === 'AA' || item.product_number === '-');
  console.log('🚀 ~ generatePlanogramFromSalesData ~ allAA:', allAA);

  if (allAA) {
    let bestName = 'Товар';
    let maxId = -1;

    salesData.data.forEach(item => {
      const id = item.planogram?.id;
      if (id && id > maxId) {
        maxId = id;
        bestName = item.planogram.name;
      }
    });

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

  // 1. Собираем записи, выбирая товар с максимальным ID для каждой ячейки
  const bestEntryByProductNumber = new Map<string, { name: string; id: number }>();

  salesData.data.forEach(item => {
    if (!item.product_number || !item.planogram?.name) return;

    const hasIngredients =
      item.planogram.ingredients && item.planogram.ingredients.length > 0;
    if (hasIngredients) {
      coffeeProductNumbers.add(item.product_number);
    }

    const productNumber = item.product_number;
    const originalName = item.planogram.name;
    const planogramId = item.planogram.id || 0;

    if (
      originalName === 'пр' ||
      (originalName.toLowerCase().includes('нет данных') &&
        item.planogram?.price === 0)
    )
      return;

    const existing = bestEntryByProductNumber.get(productNumber);
    
    // Если для этой ячейки еще нет записи ИЛИ текущий ID больше (товар свежее) - обновляем
    if (!existing || planogramId > existing.id) {
      bestEntryByProductNumber.set(productNumber, {
        name: originalName,
        id: planogramId
      });
    }
  });

  // 2. Генерируем полную планограмму в правильном порядке
  const fullPlanogram: string[] = [];

  // ПОЛКА 0: 01-09
  for (let i = 1; i <= 9; i++) {
    const key = `${i}`;
    const bestEntry = bestEntryByProductNumber.get(key);
    if (bestEntry) {
      fullPlanogram.push(`0${i}. ${bestEntry.name}`);
    }
  }

  // ПОЛКИ 1-6
  for (let shelf = 1; shelf <= 6; shelf++) {
    // Цифровые ячейки: 10-19, 20-29, ...
    for (let i = 0; i <= 9; i++) {
      const key = `${shelf}${i}`;
      const bestEntry = bestEntryByProductNumber.get(key);
      if (bestEntry) fullPlanogram.push(`${key}. ${bestEntry.name}`);
    }

    // Буквенные ячейки: 1A, 1B, 2A, 2B, ...
    const bestEntryA = bestEntryByProductNumber.get(`${shelf}A`);
    if (bestEntryA) fullPlanogram.push(`${shelf}A. ${bestEntryA.name}`);

    const bestEntryB = bestEntryByProductNumber.get(`${shelf}B`);
    if (bestEntryB) fullPlanogram.push(`${shelf}B. ${bestEntryB.name}`);
  }

  // 3. Сортируем
  const sorted = sortPlanogramStrings(fullPlanogram);
  console.log('Итоговая планограмма:', sorted.length, 'элементов');

  return {
    planogram: sorted,
    coffeeProductNumbers: Array.from(coffeeProductNumbers),
  };
}
