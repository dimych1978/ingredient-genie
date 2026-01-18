import type {
  TelemetronSaleItem,
  LoadingOverrides,
  ShoppingListItem,
  Ingredient,
} from '@/types/telemetron';

import {
  allMachines,
  machineIngredients,
  getIngredientConfig,
  planogramsHardCode,
  getMachineType,
} from './data';

export type SortType = 'grouped' | 'alphabetical';

export function normalizeForPlanogramComparison(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

const getDisplayUnit = (
  apiAmount: number,
  configUnit: 'г' | 'кг' | 'мл' | 'л' | 'шт'
): { unit: string; displayAmount: number } => {
  if (configUnit === 'л' && apiAmount >= 1000) {
    return { unit: 'л', displayAmount: apiAmount / 1000 };
  }
  if (configUnit === 'кг' && apiAmount >= 1000) {
    return { unit: 'кг', displayAmount: apiAmount / 1000 };
  }
  return { unit: configUnit, displayAmount: apiAmount };
};

export const calculateShoppingList = (
  salesData: { data: TelemetronSaleItem[] },
  sort: SortType = 'grouped',
  overrides: LoadingOverrides = {},
  machineId: string,
  planogram?: string[],
  machineModel?: string,
  salesThisPeriod?: Map<string, number>,
  coffeeProductNumbers?: string[],
  isSavedPlanogram?: boolean
): ShoppingListItem[] => {
  const machine = allMachines.find(m => m.id === machineId);
  const machineType = machine ? getMachineType(machine) : 'snack';
  console.log('isSavedPlanogram в калькуляторе:', isSavedPlanogram);

  // 1. ОБРАБОТКА БУТМАТОВ - отдельная простая логика
  if (machineType === 'bottle') {
    return calculateBottleShoppingList(salesData, overrides, machineId);
  }

  const lowerMachineModel = machine?.model?.toLowerCase();
  const matchingKeys = lowerMachineModel
    ? Object.keys(machineIngredients).filter(key =>
        lowerMachineModel.includes(key.toLowerCase())
      )
    : [];
  matchingKeys.sort((a, b) => b.length - a.length);
  const modelKey = matchingKeys.length > 0 ? matchingKeys[0] : undefined;
  const coreIngredientConfigs = modelKey ? machineIngredients[modelKey] : [];

  // 2. Логика для сохраненной планограммы - самая простая и быстрая
  if (isSavedPlanogram && planogram && planogram.length > 0) {
    const itemsMap = new Map<string, ShoppingListItem>();

    // 2.1 Создаем "карту аппарата" из сохраненной планограммы
    planogram.forEach(entry => {
      const match = entry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
      if (match) {
        const productNumber = match[1];
        const name = match[2];
        itemsMap.set(productNumber, {
          name: name,
          productNumber: productNumber,
          planogramName: entry,
          amount: 0,
          unit: 'шт',
          salesAmount: 0,
          previousDeficit: 0,
          isCore: false,
          type: 'auto',
          status: 'none',
        });
      }
    });

    // 2.2 Накладываем продажи
    salesData.data.forEach(sale => {
      if (sale.product_number && itemsMap.has(sale.product_number)) {
        const item = itemsMap.get(sale.product_number)!;
        item.salesAmount = (item.salesAmount || 0) + sale.number;
      }
    });

    // 2.3 Накладываем остатки
    Object.entries(overrides).forEach(([key, override]) => {
      const itemName = key.replace(`${machineId}-`, '');
      // Ищем товар по имени, так как в Redis ключ без productNumber
      for (const item of itemsMap.values()) {
        if (item.name === itemName) {
          item.previousDeficit = override.carryOver || 0;
          break;
        }
      }
    });

    // 2.4 Финальный расчет и возврат
    const result: ShoppingListItem[] = [];
    itemsMap.forEach(item => {
      item.amount = Math.ceil(
        Math.max(0, (item.salesAmount || 0) + (item.previousDeficit || 0))
      );
      result.push(item);
    });

    return result;
  }

  // 3. Логика, если НЕТ сохраненной планограммы (isSavedPlanogram: false)
  if (planogram && planogram.length === 1 && planogram[0].startsWith('AA')) {
    // Логика для аппарата AA
    const name = planogram[0].replace(/^AA\.?\s*/, '');

    // Суммируем все продажи
    let totalSales = 0;
    salesData.data.forEach(sale => {
      totalSales += sale.number;
    });

    // Ищем остатки по имени
    let carryOver = 0;
    Object.entries(overrides).forEach(([key, override]) => {
      if (key.includes(name)) {
        carryOver = override.carryOver || 0;
      }
    });

    return [
      {
        name,
        productNumber: 'AA',
        planogramName: planogram[0],
        amount: Math.ceil(Math.max(0, totalSales + carryOver)),
        unit: 'шт',
        salesAmount: totalSales,
        previousDeficit: carryOver,
        isCore: false,
        type: 'auto',
        status: 'none',
      },
    ];
  }

  const itemMap = new Map<string, ShoppingListItem>();

  // 3.1. Создаем "карту" из 365-дневной планограммы, если она есть
  if (planogram && planogram.length > 0) {
    planogram.forEach(entry => {
      const match = entry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
      if (match) {
        const productNumber = match[1];
        const name = match[2];

        const config = getIngredientConfig(name, machineModel);

        if (!itemMap.has(productNumber)) {
          itemMap.set(productNumber, {
            name: name,
            productNumber: productNumber,
            planogramName: entry,
            amount: 0,
            unit: config?.unit || 'шт',
            salesAmount: 0,
            previousDeficit: 0,
            isCore: coreIngredientConfigs.some(c => c.name === name),
            type: config?.type || 'auto',
            syrupOptions: config?.syrupOptions,
            status: 'none',
          });
        }
      }
    });
  }

  // 3.2. Добавляем в карту кофейные ингредиенты, которых там может не быть
  coreIngredientConfigs.forEach(config => {
    // Ключ для кофейных - их имя
    const key = config.name;
    if (!Array.from(itemMap.values()).some(item => item.name === key)) {
      itemMap.set(key, {
        name: config.name,
        planogramName: config.name,
        amount: 0,
        unit: config.unit,
        salesAmount: 0,
        previousDeficit: 0,
        isCore: true,
        type: config.type,
        syrupOptions: config.syrupOptions,
        status: 'none',
      });
    }
  });

  // 3.3. Накладываем продажи
    // Для аппаратов без планограммы
    if (planogram && planogram.length === 1 && planogram[0].startsWith('AA')) {
      // 1. Название из API
      const apiName = salesData.data[0]?.planogram?.name || 'Товар';

      // 2. Сумма всех продаж
      let totalSales = 0;
      salesData.data.forEach(sale => {
        totalSales += sale.number;
      });

      // 3. Остатки из overrides
      let carryOver = 0;
      Object.entries(overrides).forEach(([key, override]) => {
        if (key.includes(apiName) || key.includes(machineId)) {
          carryOver = override.carryOver || 0;
        }
      });

      // 4. Возвращаем ОДИН товар
      return [
        {
          name: apiName, // ← "Шок.бат. Сникерс 55 гр."
          productNumber: 'AA',
          planogramName: planogram[0],
          amount: Math.ceil(Math.max(0, totalSales + carryOver)),
          unit: 'шт',
          salesAmount: totalSales,
          previousDeficit: carryOver,
          isCore: false,
          type: 'auto',
          status: 'none',
        },
      ];
    }

  salesData.data.forEach(sale => {
    if (!sale.planogram?.name) return;

    // Кофейные напитки
    if (sale.planogram.ingredients && sale.planogram.ingredients.length > 0) {
      sale.planogram.ingredients.forEach(apiIngredient => {
        const config = getIngredientConfig(apiIngredient.name, machineModel);
        if (config) {
          const item = Array.from(itemMap.values()).find(
            i => i.name === config.name
          );
          if (item) {
            item.salesAmount =
              (item.salesAmount || 0) + apiIngredient.volume * sale.number;
          }
        }
      });
    }

    // Снеки
    else if (sale.product_number && itemMap.has(sale.product_number)) {
      const item = itemMap.get(sale.product_number)!;
      item.salesAmount = (item.salesAmount || 0) + sale.number;
    }
  });

  // 3.4. Накладываем остатки из Redis
  Object.entries(overrides).forEach(([key, override]) => {
    const itemName = key.replace(`${machineId}-`, '');
    for (const item of itemMap.values()) {
      if (item.name === itemName) {
        item.previousDeficit = override.carryOver || 0;
        break;
      }
    }
  });

  // 3.5. Финальный расчет и сортировка
  const result: ShoppingListItem[] = [];
  itemMap.forEach(item => {
    item.amount = Math.ceil(
      Math.max(0, (item.salesAmount || 0) + (item.previousDeficit || 0))
    );
    result.push(item);
  });

  // Сортировка: сначала core, потом по productNumber
  result.sort((a, b) => {
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    if (a.isCore && b.isCore) {
      const indexA = coreIngredientConfigs.findIndex(c => c.name === a.name);
      const indexB = coreIngredientConfigs.findIndex(c => c.name === b.name);
      return indexA - indexB;
    }

    // Исправленная "естественная" сортировка по productNumber
    const aPN = a.productNumber || '';
    const bPN = b.productNumber || '';

    // 1. Сравниваем по номеру полки (первая цифра)
    const aShelf = parseInt(aPN.substring(0, 1), 10) || Infinity;
    const bShelf = parseInt(bPN.substring(0, 1), 10) || Infinity;
    if (aShelf !== bShelf) {
      return aShelf - bShelf;
    }

    // 2. Внутри одной полки, числовые ячейки идут перед буквенными
    const isANumeric = /^\d+$/.test(aPN);
    const isBNumeric = /^\d+$/.test(bPN);
    if (isANumeric && !isBNumeric) return -1;
    if (!isANumeric && isBNumeric) return 1;

    // 3. Если оба числовые или оба буквенные, сравниваем как строки
    return aPN.localeCompare(bPN);
  });

  return result;
};

// Функция для бутматов
function calculateBottleShoppingList(
  salesData: { data: TelemetronSaleItem[] },
  overrides: LoadingOverrides,
  machineId: string
): ShoppingListItem[] {
  const salesByName = new Map<string, number>();
  const carryOverByName = new Map<string, number>();

  // Продажи
  salesData.data.forEach(sale => {
    if (!sale.planogram?.name) return;
    const normalizedName = normalizeBottleName(sale.planogram.name);
    if (normalizedName) {
      const current = salesByName.get(normalizedName) || 0;
      salesByName.set(normalizedName, current + sale.number);
    }
  });

  // Переносы
  Object.entries(overrides).forEach(([overrideKey, override]) => {
    if (!overrideKey.startsWith(`${machineId}-`)) return;
    const itemNameFromOverride = overrideKey.replace(`${machineId}-`, '');
    const normalizedName = normalizeBottleName(itemNameFromOverride);
    if (normalizedName && override.carryOver) {
      const current = carryOverByName.get(normalizedName) || 0;
      carryOverByName.set(normalizedName, current + override.carryOver);
    }
  });

  // Итоговый список по захардкоженной планограмме
  const result: ShoppingListItem[] = [];
  planogramsHardCode.bottle.forEach(itemName => {
    const sales = salesByName.get(itemName) || 0;
    const carryOver = carryOverByName.get(itemName) || 0;
    const totalNeeded = Math.max(0, sales + carryOver);

    result.push({
      name: itemName,
      planogramName: itemName,
      amount: totalNeeded,
      unit: 'шт',
      salesAmount: sales,
      previousDeficit: carryOver,
      isCore: false,
      type: 'auto',
      status: 'none',
      checked: false,
    });
  });
  return result;
}

function normalizeBottleName(apiName: string): string | null {
  const cleanApiName = apiName
    .replace(/["«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  for (const hardcodedName of planogramsHardCode.bottle) {
    const cleanHardcoded = hardcodedName
      .replace(/["«»]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const hardcodedWords = cleanHardcoded.split(' ');
    const matches = hardcodedWords.filter(
      word => word.length > 2 && cleanApiName.includes(word)
    );

    if (matches.length >= Math.max(1, hardcodedWords.length / 2)) {
      return hardcodedName;
    }
  }
  return null;
}
