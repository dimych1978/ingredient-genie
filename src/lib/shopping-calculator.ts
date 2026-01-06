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

const normalizeForPlanogramComparison = (name: string): string => {
  return name
    .replace(/["«»"']/g, '')
    .replace(/[.,]$/g, '')
    .replace(/\s*в ассорт(именте)?\.?/gi, ' в ассорт')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const findPlanogramEntry = (
  itemName: string,
  planogram: string[]
): string | null => {
  const normalizedItem = normalizeForPlanogramComparison(itemName);

  for (const planogramEntry of planogram) {
    // Извлекаем название из записи планограммы
    // Формат: "29. Круассаны Яшкино 45г" или "29A. Название товара"
    const match = planogramEntry.match(/^\d+[A-Za-z]?\.\s*(.+)$/);
    
    if (!match) {
      // Если нет номера ячейки, используем всю строку
      const planogramName = planogramEntry;
      const normalizedVariant = normalizeForPlanogramComparison(planogramName);
      
      if (
        normalizedItem.includes(normalizedVariant) ||
        normalizedVariant.includes(normalizedItem)
      ) {
        return planogramEntry; // Возвращаем полную запись (с номером ячейки)
      }
      continue;
    }
    
    // Есть номер ячейки
    const planogramName = match[1]; // "Круассаны Яшкино 45г"
    const normalizedVariant = normalizeForPlanogramComparison(planogramName);

    if (
      normalizedItem.includes(normalizedVariant) ||
      normalizedVariant.includes(normalizedItem)
    ) {
      return planogramEntry; // Возвращаем полную запись "29. Круассаны Яшкино 45г"
    }
  }

  return null;
};

const findPlanogramIndex = (itemName: string, planogram: string[]): number => {
  const entry = findPlanogramEntry(itemName, planogram);
  if (entry) {
    return planogram.indexOf(entry);
  }
  return -1;
};

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
  coffeeProductNumbers?: string[]
): ShoppingListItem[] => {
  const machine = allMachines.find(m => m.id === machineId);
  const machineType = machine ? getMachineType(machine) : 'snack';

  // 1. ОБРАБОТКА БУТМАТОВ - используем захардкоженную планограмму
  if (machineType === 'bottle') {
    return calculateBottleShoppingList(salesData, overrides, machineId);
  }

  // 2. ОСНОВНАЯ ЛОГИКА (для кофе и снеков)
  const lowerMachineModel = machine?.model?.toLowerCase();
  const matchingKeys = lowerMachineModel
    ? Object.keys(machineIngredients).filter(key =>
        lowerMachineModel.includes(key.toLowerCase())
      )
    : [];
  matchingKeys.sort((a, b) => b.length - a.length);
  const modelKey = matchingKeys.length > 0 ? matchingKeys[0] : undefined;
  const coreIngredientConfigs = modelKey ? machineIngredients[modelKey] : [];
  const coffeeProductNumbersSet = new Set(coffeeProductNumbers || []);

  const totals: Record<
    string,
    {
      amount: number;
      config: Ingredient;
      sales: number;
      carryOver: number;
      productNumber?: string;
      planogramName: string | null;
    }
  > = {};

  // 2.1. Обработка продаж из API (ЛОГИКА ИЗ MASTER)
  salesData.data.forEach(sale => {
    if (
      !sale.planogram ||
      !sale.planogram.name ||
      sale.planogram.name.toLowerCase() === 'item'
    ) {
      return;
    }

    const quantity = sale.number;
    const productNumber = sale.product_number;
    const isCoffeeDrink = coffeeProductNumbersSet.has(productNumber);

    if (sale.planogram.ingredients && sale.planogram.ingredients.length > 0 && isCoffeeDrink) {
      // Кофейный напиток -> ингредиенты
      sale.planogram.ingredients.forEach(apiIngredient => {
        const config = getIngredientConfig(apiIngredient.name, machine?.model);
        if (config) {
          const key = config.name; // ВАЖНО: ключ остается по имени, как в master
          const amount = apiIngredient.volume * quantity;

          if (!totals[key]) {
            totals[key] = {
              amount: 0,
              config,
              sales: 0,
              carryOver: 0,
              planogramName: null,
            };
          }
          totals[key].amount += amount;
          totals[key].sales += amount;
        }
      });
    } else {
      // Снек или не-кофейный товар
      const config = getIngredientConfig(sale.planogram.name, machine?.model);
      const key = config ? config.name : sale.planogram.name;
      if (!totals[key]) {
        totals[key] = {
          amount: 0,
          config: config || {
            name: key,
            unit: 'шт',
            type: 'auto',
            apiNames: [key],
          },
          sales: 0,
          carryOver: 0,
          productNumber: productNumber,
          planogramName: findPlanogramEntry(sale.planogram.name, planogram || []),
        };
      }
      totals[key].amount += quantity;
      totals[key].sales += quantity;
      // Сохраняем productNumber для снеков
      if (!totals[key].productNumber) {
        totals[key].productNumber = productNumber;
      }
    }
  });

  // 2.2. Обработка переносов (overrides) - ЛОГИКА ИЗ MASTER (ключ ${machineId}-${name})
  Object.keys(overrides).forEach(overrideKey => {
    if (!overrideKey.startsWith(`${machineId}-`)) return;

    const itemNameFromOverride = overrideKey.replace(`${machineId}-`, '');
    if (itemNameFromOverride.toLowerCase() === 'item') return;

    const override = overrides[overrideKey];

    if (override.carryOver !== undefined && override.carryOver !== null) {
      const config = getIngredientConfig(itemNameFromOverride, machine?.model);
      const key = config ? config.name : itemNameFromOverride;

      if (!totals[key]) {
        totals[key] = {
          amount: 0,
          config: config || {
            name: key,
            unit: 'шт',
            type: 'auto',
            apiNames: [key],
          },
          sales: 0,
          carryOver: 0,
          planogramName: findPlanogramEntry(key, planogram || []),
        };
      }
      // ВАЖНО: ПРАВИЛЬНО суммируем carryOver с продажами
      totals[key].amount += override.carryOver;
      totals[key].carryOver = override.carryOver;
    }
  });

  const allItems: ShoppingListItem[] = [];

  // 3. Формируем финальный список
  Object.keys(totals).forEach(key => {
    const data = totals[key];
    const { unit: displayUnit, displayAmount } = getDisplayUnit(
      data.amount,
      data.config.unit as 'г' | 'кг' | 'мл' | 'л' | 'шт'
    );
    const { displayAmount: salesDisplayAmount } = getDisplayUnit(
      data.sales,
      data.config.unit as 'г' | 'кг' | 'мл' | 'л' | 'шт'
    );
    const { displayAmount: deficitDisplayAmount } = getDisplayUnit(
      data.carryOver,
      data.config.unit as 'г' | 'кг' | 'мл' | 'л' | 'шт'
    );

    allItems.push({
      name: data.config.name,
      productNumber: data.productNumber, // Для снеков
      planogramName: data.planogramName,
      amount: Math.ceil(Math.max(0, displayAmount)),
      unit: displayUnit,
      status: overrides[`${machineId}-${key}`]?.status || 'none', // Старый формат ключа
      salesAmount: Math.ceil(salesDisplayAmount),
      previousDeficit: Math.ceil(deficitDisplayAmount),
      isCore: !!modelKey && coreIngredientConfigs.some(c => c.name === data.config.name),
      type: data.config.type || 'auto',
      syrupOptions: data.config.syrupOptions,
      checked: false,
    });
  });

  // 4. СОРТИРОВКА (ЛОГИКА ИЗ PLANOGRAM, АДАПТИРОВАННАЯ)
  allItems.sort((a, b) => {
    const aIsCore = a.isCore;
    const bIsCore = b.isCore;

    // Кофейные ингредиенты всегда первые, в порядке из data.ts
    if (aIsCore && !bIsCore) return -1;
    if (!aIsCore && bIsCore) return 1;
    if (aIsCore && bIsCore) {
      const indexA = coreIngredientConfigs.findIndex(c => c.name === a.name);
      const indexB = coreIngredientConfigs.findIndex(c => c.name === b.name);
      return indexA - indexB;
    }

    // Для снеков: сортировка по планограмме
    if (planogram && planogram.length > 0 && a.productNumber && b.productNumber) {
      const getOrder = (productNumber: string) => {
        for (let i = 0; i < planogram.length; i++) {
          if (planogram[i].startsWith(`${productNumber}.`)) {
            return i;
          }
        }
        return planogram.length; // Если не найден - в конец
      };
      const orderA = getOrder(a.productNumber);
      const orderB = getOrder(b.productNumber);
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name, 'ru');
  });

  return allItems;
};

// Функция для бутматов (взята из planogram, но исправлена)
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

  // Переносы (ищем по старому формату ключа)
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
    const totalNeeded = Math.max(0, sales + carryOver); // Правильное суммирование

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
    const matches = hardcodedWords.filter(word =>
      word.length > 2 && cleanApiName.includes(word)
    );

    if (matches.length >= Math.max(1, hardcodedWords.length / 2)) {
      return hardcodedName;
    }
  }
  return null;
}