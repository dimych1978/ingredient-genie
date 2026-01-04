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
} from './data';

export type SortType = 'grouped' | 'alphabetical';

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
  machineType?: 'coffee' | 'snack' | 'bottle'
): ShoppingListItem[] => {
  console.log('=== Единый калькулятор запущен ===');

  const machine = allMachines.find(m => m.id === machineId);
  const model = machineModel || machine?.model;
  const modelKey = getModelKey(model);
  const coreIngredientConfigs = modelKey ? machineIngredients[modelKey] : [];

  // Сначала определяем бутматы
if (machineType === 'bottle') {
    return calculateBottleShoppingList(salesData, overrides, machineId);
  }

function calculateBottleShoppingList(
  salesData: { data: TelemetronSaleItem[] },
  overrides: LoadingOverrides,
  machineId: string
): ShoppingListItem[] {
  // 1. Создаём Map для суммирования продаж по НАЗВАНИЮ
  const salesByName = new Map<string, number>();
  
  salesData.data.forEach(sale => {
    if (!sale.planogram?.name) return;
    
    const name = sale.planogram.name;
    // НОРМАЛИЗУЕМ название - приводим к виду из planogramsHardcode.bottle
    const normalizedName = normalizeBottleName(name);
    
    if (normalizedName) {
      const current = salesByName.get(normalizedName) || 0;
      salesByName.set(normalizedName, current + sale.number);
    }
  });
  
  // 2. Добавляем переносы (carryOver) - тоже группируем по нормализованному имени
  const carryOverByName = new Map<string, number>();
  
  Object.entries(overrides).forEach(([overrideKey, override]) => {
    if (!overrideKey.startsWith(`${machineId}-`)) return;
    
    // Извлекаем название из ключа
    const parts = overrideKey.replace(`${machineId}-`, '').split('-');
    if (parts.length < 2) return;
    
    const name = parts[1];
    const normalizedName = normalizeBottleName(name);
    
    if (normalizedName && override.carryOver) {
      const current = carryOverByName.get(normalizedName) || 0;
      carryOverByName.set(normalizedName, current + override.carryOver);
    }
  });
  
  // 3. Создаём итоговый список в порядке захардкоженной планограммы
  const result: ShoppingListItem[] = [];
  
  planogramsHardCode.bottle.forEach(itemName => {
    const sales = salesByName.get(itemName) || 0;
    const carryOver = carryOverByName.get(itemName) || 0;
    const totalNeeded = Math.max(0, sales + carryOver);
    
    // if (totalNeeded > 0) { // Только товары с продажами или переносом
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
    // }
  });
  
  return result;
}

  // Функция нормализации названия
function normalizeBottleName(apiName: string): string | null {
  // Убираем кавычки, лишние пробелы, приводим к нижнему регистру
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
    
    // Проверяем, содержит ли apiName ключевые слова из hardcodedName
    const hardcodedWords = cleanHardcoded.split(' ');
    const matches = hardcodedWords.filter(word => 
      word.length > 2 && cleanApiName.includes(word)
    );
    
    // Если большинство слов совпадает
    if (matches.length >= Math.max(1, hardcodedWords.length / 2)) {
      return hardcodedName;
    }
  }
  return null;
}

  // Шаг 1: Собираем все продажи в структурированном виде
  const { coffeeItems, snackItems } = processSalesData(
    salesData.data,
    machineId,
    model,
    overrides,
    salesThisPeriod
  );

  // Шаг 2: Обрабатываем кофейные ингредиенты (преобразуем напитки → ингредиенты)
  const coffeeIngredients = processCoffeeIngredients(
    coffeeItems,
    coreIngredientConfigs,
    machineId,
    model,
    overrides
  );

  // Шаг 3: Обрабатываем снеки (товары напрямую)
  const snacks = processSnacks(
    snackItems,
    machineId,
    overrides,
    planogram,
    model,
    salesThisPeriod,
    coffeeProductNumbers
  );

  // Шаг 4: Сортируем итоговый список
  return sortFinalList(
    coffeeIngredients,
    snacks,
    coreIngredientConfigs,
    planogram,
    modelKey
  );
};

// === Вспомогательные функции ===

function getModelKey(machineModel?: string): string | undefined {
  if (!machineModel) return undefined;
  const lowerModel = machineModel.toLowerCase();
  const matchingKeys = Object.keys(machineIngredients).filter(key =>
    lowerModel.includes(key.toLowerCase())
  );
  matchingKeys.sort((a, b) => b.length - a.length);
  return matchingKeys[0];
}

function processSalesData(
  salesData: TelemetronSaleItem[],
  machineId: string,
  machineModel?: string,
  overrides?: LoadingOverrides,
  salesThisPeriod?: Map<string, number>
) {
  const coffeeItems: Array<{
    name: string;
    quantity: number;
    ingredients: Array<{ name: string; volume: number }>;
    productNumber?: string;
  }> = [];

  const snackItems: Array<{
    name: string;
    quantity: number;
    productNumber: string;
    planogramName: string;
  }> = [];

  salesData.forEach(sale => {
    if (!sale.product_number || !sale.planogram?.name) return;

    console.log(
      `${sale.product_number}. ${sale.planogram.name}:`,
      'ingredients?',
      !!sale.planogram.ingredients,
      'length:',
      sale.planogram.ingredients?.length
    );

    if (sale.planogram.ingredients && sale.planogram.ingredients.length > 0) {
      console.log('  → В coffeeItems');
      coffeeItems.push({
        name: sale.planogram.name,
        quantity: sale.number,
        ingredients: sale.planogram.ingredients,
        productNumber: sale.product_number,
      });
    } else {
      console.log('  → В snackItems');
      snackItems.push({
        name: sale.planogram.name,
        quantity: sale.number,
        productNumber: sale.product_number,
        planogramName: sale.planogram.name,
      });
    }

    // Определяем тип: кофейный напиток или снек
    if (sale.planogram.ingredients && sale.planogram.ingredients.length > 0) {
      // Кофейный напиток
      coffeeItems.push({
        name: sale.planogram.name,
        quantity: sale.number,
        ingredients: sale.planogram.ingredients,
        productNumber: sale.product_number,
      });
    } else {
      // Снек
      snackItems.push({
        name: sale.planogram.name,
        quantity: sale.number,
        productNumber: sale.product_number,
        planogramName: sale.planogram.name,
      });
    }
  });

  return { coffeeItems, snackItems };
}

function processCoffeeIngredients(
  coffeeItems: Array<{
    name: string;
    quantity: number;
    ingredients: Array<{ name: string; volume: number }>;
  }>,
  coreIngredientConfigs: Ingredient[],
  machineId: string,
  machineModel?: string,
  overrides: LoadingOverrides = {}
) {
  const ingredientTotals = new Map<
    string,
    {
      amount: number;
      sales: number;
      carryOver: number;
      config: Ingredient;
    }
  >();

  // Обработка кофейных напитков → ингредиенты
  coffeeItems.forEach(item => {
    item.ingredients.forEach(apiIngredient => {
      const config = getIngredientConfig(apiIngredient.name, machineModel);
      if (!config) return;

      const key = config.name;
      const amount = apiIngredient.volume * item.quantity;

      const current = ingredientTotals.get(key) || {
        amount: 0,
        sales: 0,
        carryOver: 0,
        config,
      };

      current.amount += amount;
      current.sales += amount;
      ingredientTotals.set(key, current);
    });
  });

  // Добавляем переносы (carryOver) из overrides
  Object.entries(overrides).forEach(([overrideKey, override]) => {
    if (!overrideKey.startsWith(`${machineId}-`)) return;

    // Извлекаем название товара из ключа: "machineId-productNumber-name"
    const parts = overrideKey.replace(`${machineId}-`, '').split('-');
    if (parts.length < 2) return;

    const itemName = parts.slice(1).join('-'); // Восстанавливаем имя с дефисами
    if (itemName.toLowerCase() === 'item') return;

    const config = getIngredientConfig(itemName, machineModel);
    if (!config) return;

    const key = config.name;
    const current = ingredientTotals.get(key) || {
      amount: 0,
      sales: 0,
      carryOver: 0,
      config,
    };

    if (override.carryOver !== undefined && override.carryOver !== null) {
      current.amount += override.carryOver;
      current.carryOver = override.carryOver;
      ingredientTotals.set(key, current);
    }
  });

  // Преобразуем в ShoppingListItem[]
  const coffeeIngredients: ShoppingListItem[] = [];

  ingredientTotals.forEach((data, key) => {
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

    const overrideKey = `${machineId}-${key}`;
    const override = overrides[overrideKey];

    coffeeIngredients.push({
      name: data.config.name,
      planogramName: data.config.name,
      amount: Math.ceil(Math.max(0, displayAmount)),
      unit: displayUnit,
      status: override?.status || 'none',
      salesAmount: Math.ceil(salesDisplayAmount),
      previousDeficit: Math.ceil(deficitDisplayAmount),
      isCore: coreIngredientConfigs.some(c => c.name === data.config.name),
      type: data.config.type || 'auto',
      syrupOptions: data.config.syrupOptions,
      checked: override?.checked || false,
    });
  });

  return coffeeIngredients;
}

function processSnacks(
  snackItems: Array<{
    name: string;
    quantity: number;
    productNumber: string;
    planogramName: string;
  }>,
  machineId: string,
  overrides: LoadingOverrides,
  planogram?: string[],
  machineModel?: string,
  salesThisPeriod?: Map<string, number>,
  coffeeProductNumbers?: string[]
) {
  const snacks: ShoppingListItem[] = [];
  const usedPlanogramEntries = new Set<string>();

  const coffeeProductNumbersSet = new Set(coffeeProductNumbers || []);

  // Планограмма для снеков ВСЕГДА есть в API
  if (planogram && planogram.length > 0) {
    planogram.forEach(planogramEntry => {
      const match = planogramEntry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
      if (!match) return;

      const productNumber = match[1];

      if (coffeeProductNumbersSet.has(productNumber)) {
        return; // Пропускаем кофейные напитки
      }

      const planogramName = match[2];

      // Ищем продажи для этой ячейки
      const salesForCell = snackItems.filter(
        item => item.productNumber === productNumber
      );

      // Выбираем правильное имя на основе salesThisPeriod
      let selectedName = planogramName;
      let selectedQuantity = 0;

      if (salesForCell.length > 0) {
        const hasSalesInThisPeriod = salesThisPeriod
          ? (salesThisPeriod.get(productNumber) || 0) > 0
          : true; // Для планограммы всегда считаем, что есть продажи в этом периоде

        if (hasSalesInThisPeriod) {
          const salesWithQuantity = salesForCell.find(s => s.quantity > 0);
          if (salesWithQuantity) {
            selectedName = salesWithQuantity.name;
            selectedQuantity = salesWithQuantity.quantity;
          }
        } else if (salesForCell.length > 0) {
          selectedName = salesForCell[0].name;
          selectedQuantity = salesForCell[0].quantity;
        }
      }

      // Обработка override и carryOver
      const overrideKey = `${machineId}-${productNumber}-${selectedName}`;
      const override = overrides[overrideKey];
      const carryOver = override?.carryOver || 0;
      const totalNeeded = Math.max(0, selectedQuantity + carryOver);

      // Определяем тип и единицы
      const config = getIngredientConfig(selectedName, machineModel);
      let unit = 'шт';
      let displaySales = selectedQuantity;
      let displayDeficit = carryOver;

      if (config) {
        const salesUnit = getDisplayUnit(selectedQuantity, config.unit as any);
        const deficitUnit = getDisplayUnit(carryOver, config.unit as any);
        unit = salesUnit.unit;
        displaySales = Math.ceil(salesUnit.displayAmount);
        displayDeficit = Math.ceil(deficitUnit.displayAmount);
      }

      snacks.push({
        name: selectedName,
        planogramName: selectedName,
        productNumber: productNumber,
        amount: totalNeeded,
        unit: unit,
        salesAmount: displaySales,
        previousDeficit: displayDeficit,
        isCore: false,
        type: config?.type || 'auto',
        syrupOptions: config?.syrupOptions,
        status: override?.status || 'none',
        checked: override?.checked || false,
      });

      usedPlanogramEntries.add(`${productNumber}-${selectedName}`);
    });
  }

  // Добавляем снеки, которые есть в продажах, но нет в планограмме
  // (если товар продался в этом периоде, но не продавался 30+ дней)
  snackItems.forEach(item => {
    const key = `${item.productNumber}-${item.name}`;
    if (usedPlanogramEntries.has(key)) return;

    const overrideKey = `${machineId}-${item.productNumber}-${item.name}`;
    const override = overrides[overrideKey];
    const carryOver = override?.carryOver || 0;
    const totalNeeded = Math.max(0, item.quantity + carryOver);

    const config = getIngredientConfig(item.name, machineModel);
    let unit = 'шт';
    let displaySales = item.quantity;
    let displayDeficit = carryOver;

    if (config) {
      const salesUnit = getDisplayUnit(item.quantity, config.unit as any);
      const deficitUnit = getDisplayUnit(carryOver, config.unit as any);
      unit = salesUnit.unit;
      displaySales = Math.ceil(salesUnit.displayAmount);
      displayDeficit = Math.ceil(deficitUnit.displayAmount);
    }

    snacks.push({
      name: item.name,
      planogramName: item.name,
      productNumber: item.productNumber,
      amount: totalNeeded,
      unit: unit,
      salesAmount: displaySales,
      previousDeficit: displayDeficit,
      isCore: false,
      type: config?.type || 'auto',
      syrupOptions: config?.syrupOptions,
      status: override?.status || 'none',
      checked: override?.checked || false,
    });
  });

  return snacks;
}

function sortFinalList(
  coffeeIngredients: ShoppingListItem[],
  snacks: ShoppingListItem[],
  coreIngredientConfigs: Ingredient[],
  planogram?: string[],
  modelKey?: string
): ShoppingListItem[] {
  // Сортируем кофейные ингредиенты по порядку из data.ts
  const sortedCoffee = coffeeIngredients.sort((a, b) => {
    const indexA = coreIngredientConfigs.findIndex(c => c.name === a.name);
    const indexB = coreIngredientConfigs.findIndex(c => c.name === b.name);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return a.name.localeCompare(b.name, 'ru');
  });

  // Сортируем снеки ТОЛЬКО по планограмме (она всегда есть для снеков)
  const sortedSnacks = snacks.sort((a, b) => {
    // Сначала пробуем найти в планограмме
    if (planogram && planogram.length > 0) {
      const getProductNumberFromPlanogram = (productNumber?: string) => {
        if (!productNumber) return null;
        for (const entry of planogram) {
          const match = entry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
          if (match && match[1] === productNumber) {
            return match[1];
          }
        }
        return null;
      };

      const orderA = planogram.findIndex(entry => {
        const match = entry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
        return match && match[1] === a.productNumber;
      });

      const orderB = planogram.findIndex(entry => {
        const match = entry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
        return match && match[1] === b.productNumber;
      });

      if (orderA !== -1 && orderB !== -1) return orderA - orderB;
      if (orderA !== -1) return -1;
      if (orderB !== -1) return 1;
    }

    // Если нет в планограмме (например, новый товар) — в конец по алфавиту
    return a.name.localeCompare(b.name, 'ru');
  });

  // Для спарки (kikko) или чистого кофейного аппарата: сначала кофейные, потом снеки
  // Для чистого снекового аппарата: только снеки
  if (coffeeIngredients.length > 0) {
    return [...sortedCoffee, ...sortedSnacks];
  } else {
    return sortedSnacks;
  }
}
