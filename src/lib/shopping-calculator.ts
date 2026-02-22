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

function normalizeApiCellNumber(cellNumber: string): string {
  // Если число без буквы (1, 2, 3...), добавляем ведущий 0 для 1-9
  const match = cellNumber.match(/^(\d+)([A-Za-z]*)$/);
  if (!match) return cellNumber;

  const num = parseInt(match[1], 10);
  const suffix = match[2];

  // 1-9 → 01-09
  if (num >= 1 && num <= 9 && suffix === '') {
    return `0${num}`;
  }

  // Остальные оставляем как есть: 10, 11, 1A, 1B...
  return cellNumber;
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
): ShoppingListItem[] => {
  console.log('🚀 ~ calculateShoppingList ~ planogram:', planogram);
  const machine = allMachines.find(m => m.id === machineId);
  const machineType = machine ? getMachineType(machine) : 'snack';

  // 1. ОБРАБОТКА БУТМАТОВ
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

   // 2. Построение планограммы
   if (planogram && planogram.length === 1 && planogram[0].startsWith('AA')) {
    console.log(
      "🚀 ~ calculateShoppingList ~ planogram[0].startsWith('AA'):",
      planogram[0].startsWith('AA')
    );
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

  // 2.1 Создаем "карту" из 30-дневной планограммы, если она есть
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

  // 2.2. Добавляем в карту кофейные ингредиенты, которых там может не быть
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

  // 2.3. Накладываем продажи
  // Для аппаратов без планограммы

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
    else if (sale.product_number) {
      const normalizedNumber = normalizeApiCellNumber(sale.product_number);

      if (itemMap.has(normalizedNumber)) {
        const item = itemMap.get(normalizedNumber)!;
        item.salesAmount = (item.salesAmount || 0) + sale.number;
      }
    }
  });
  console.log('🚀 ~ calculateShoppingList ~ overrides:', overrides);

  // 2.4. Накладываем остатки из Redis
  Object.entries(overrides).forEach(([key, override]) => {
    const itemName = key.replace(`${machineId}-`, '');
    for (const item of itemMap.values()) {
      if (item.name === itemName) {
        item.previousDeficit = override.carryOver || 0;
        break;
      }
    }
  });

  // 2.5. Финальный расчет и сортировка
  const result: ShoppingListItem[] = [];

  itemMap.forEach(item => {
    item.amount = Math.ceil(
      Math.max((item.salesAmount || 0) + (item.previousDeficit || 0))
    );
    result.push(item);
  });

  result.sort((a, b) => {
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    return 0;
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

    const apiName = sale.planogram.name;

    const exactMatch = planogramsHardCode.bottle.find(item => item === apiName);
    if (exactMatch) {
      const current = salesByName.get(exactMatch) || 0;
      salesByName.set(exactMatch, current + sale.number);
    }
  });

  // Переносы
  Object.entries(overrides).forEach(([overrideKey, override]) => {
    if (!overrideKey.startsWith(`${machineId}-`)) return;
    const itemNameFromOverride = overrideKey.replace(`${machineId}-`, '');
    const exactMatch = planogramsHardCode.bottle.find(
      item => item === itemNameFromOverride
    );
    if (exactMatch && override.carryOver) {
      const current = carryOverByName.get(exactMatch) || 0;
      carryOverByName.set(exactMatch, current + override.carryOver);
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
