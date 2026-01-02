// shopping-calculator.ts
import type {
  TelemetronSaleItem,
  LoadingOverrides,
  ShoppingListItem,
  Ingredient,
} from '@/types/telemetron';

import { allMachines, machineIngredients, getIngredientConfig } from './data';

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
  machineModel?: string
): ShoppingListItem[] => {
  console.log('=== calculateShoppingList вызвана ===');
  
  // 1. Создаем мапу продаж по КЛЮЧУ: product_number + name
  const salesMap = new Map<string, { quantity: number; name: string; productNumber: string }>();
  
  salesData.data.forEach(sale => {
    if (!sale.product_number || !sale.planogram?.name) return;
    
    // Ключ включает product_number для различения одинаковых названий на разных ячейках
    const key = `${sale.product_number}-${sale.planogram.name}`;
    
    const current = salesMap.get(key) || { 
      quantity: 0, 
      name: sale.planogram.name,
      productNumber: sale.product_number
    };
    current.quantity += sale.number;
    salesMap.set(key, current);
  });
  
  console.log('salesMap размер (уникальных product_number + name):', salesMap.size);
  
  // 2. Если есть планограмма - используем её как основной источник
  if (planogram && planogram.length > 0) {
    console.log('=== Используем планограмму, элементов:', planogram.length);
    
    const result: ShoppingListItem[] = [];
    const usedKeys = new Set<string>();
    
    planogram.forEach(planogramEntry => {
      // Извлекаем product_number и название из планограммы
      // Формат: "1. Бонаква негаз. 0,5"
      const match = planogramEntry.match(/^(\d+[A-Za-z]?)\.\s*(.+)$/);
      
      if (!match) return;
      
      const productNumber = match[1];
      const planogramName = match[2].trim();
      
      // Ключ для поиска продаж
      const salesKey = `${productNumber}-${planogramName}`;
      
      // Находим продажи для этой конкретной ячейки
      const sales = salesMap.get(salesKey);
      const salesQuantity = sales?.quantity || 0;
      
      // Находим override (используем полное название с product_number для уникальности)
      const overrideKey = `${machineId}-${productNumber}-${planogramName}`;
      const override = overrides[overrideKey];
      const carryOver = override?.carryOver || 0;
      
      // Вычисляем сколько нужно
      const totalNeeded = Math.max(0, salesQuantity + carryOver);
      
      // Определяем тип товара
      const config = getIngredientConfig(planogramName, machineModel);
      
      // Определяем единицу измерения
      let unit = 'шт';
      let displaySales = salesQuantity;
      let displayDeficit = carryOver;
      
      if (config) {
        const salesUnit = getDisplayUnit(salesQuantity, config.unit as any);
        const deficitUnit = getDisplayUnit(carryOver, config.unit as any);
        unit = salesUnit.unit;
        displaySales = Math.ceil(salesUnit.displayAmount);
        displayDeficit = Math.ceil(deficitUnit.displayAmount);
      }
      
      result.push({
        name: planogramName,
        planogramName: planogramName,
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
      
      usedKeys.add(salesKey);
    });
    
    console.log('После планограммы, result:', result.length);
    
    // 3. Добавляем товары, которые есть в продажах, но нет в планограмме
    salesMap.forEach((sales, key) => {
      if (!usedKeys.has(key)) {
        const [productNumber, name] = key.split('-', 2);
        
        const overrideKey = `${machineId}-${productNumber}-${name}`;
        const override = overrides[overrideKey];
        const carryOver = override?.carryOver || 0;
        const totalNeeded = Math.max(0, sales.quantity + carryOver);
        
        const config = getIngredientConfig(name, machineModel);
        
        let unit = 'шт';
        let displaySales = sales.quantity;
        let displayDeficit = carryOver;
        
        if (config) {
          const salesUnit = getDisplayUnit(sales.quantity, config.unit as any);
          const deficitUnit = getDisplayUnit(carryOver, config.unit as any);
          unit = salesUnit.unit;
          displaySales = Math.ceil(salesUnit.displayAmount);
          displayDeficit = Math.ceil(deficitUnit.displayAmount);
        }
        
        result.push({
          name: name,
          planogramName: name,
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
      }
    });
    
    console.log('После добавления salesMap, result:', result.length);

    // 4. Определяем core ingredients
    const machine = allMachines.find(m => m.id === machineId);
    console.log('Machine найден?', !!machine);
    console.log('Machine model:', machine?.model);
    
    const lowerMachineModel = machine?.model?.toLowerCase();
    const matchingKeys = lowerMachineModel
      ? Object.keys(machineIngredients).filter(key =>
          lowerMachineModel.includes(key.toLowerCase())
        )
      : [];
    
    console.log('Matching keys:', matchingKeys);
    
    matchingKeys.sort((a, b) => b.length - a.length);
    const modelKey = matchingKeys.length > 0 ? matchingKeys[0] : undefined;
    const coreIngredientConfigs = modelKey ? machineIngredients[modelKey] : [];
    
    console.log('Model key:', modelKey);
    console.log('Core ingredient configs длина:', coreIngredientConfigs.length);
    console.log('Core ingredient configs:', coreIngredientConfigs);
    
    // Помечаем core ingredients
    result.forEach(item => {
      const isCore = coreIngredientConfigs.some(c => 
        c.apiNames?.some(apiName => 
          item.name.toLowerCase().includes(apiName.toLowerCase())
        ) || c.name === item.name
      );
      if (isCore) {
        console.log('Найден core ingredient:', item.name);
        item.isCore = true;
      }
    });
    
    // 5. Сортируем: сначала core, потом по порядку планограммы
    const coreItems = result.filter(item => item.isCore);
    const nonCoreItems = result.filter(item => !item.isCore);
    
    console.log('Core items:', coreItems.length);
    console.log('Non-core items:', nonCoreItems.length);
    
    // Core items сортируем как раньше
    coreItems.sort((a, b) => {
      const indexA = coreIngredientConfigs.findIndex(c => 
        c.apiNames?.some(apiName => a.name.toLowerCase().includes(apiName.toLowerCase())) || c.name === a.name
      );
      const indexB = coreIngredientConfigs.findIndex(c => 
        c.apiNames?.some(apiName => b.name.toLowerCase().includes(apiName.toLowerCase())) || c.name === b.name
      );
      return indexA - indexB;
    });
    
    const finalResult = [...coreItems, ...nonCoreItems];
    
    console.log('Итоговый результат длина:', finalResult.length);
console.log('Итоговый результат первые 25:', finalResult.slice(0, 25).map(item => ({
  name: item.name,
  productNumber: item.productNumber,
  amount: item.amount
})));
    console.log('=== Завершение calculateShoppingList ===');
    
    return finalResult;
  }
  
  console.log('=== Планограммы нет, используем старую логику ===');
  
 const machine = allMachines.find(m => m.id === machineId);
  const lowerMachineModel = machine?.model?.toLowerCase();
  const matchingKeys = lowerMachineModel
    ? Object.keys(machineIngredients).filter(key =>
        lowerMachineModel.includes(key.toLowerCase())
      )
    : [];

  matchingKeys.sort((a, b) => b.length - a.length);
  const modelKey = matchingKeys.length > 0 ? matchingKeys[0] : undefined;
  const coreIngredientConfigs = modelKey ? machineIngredients[modelKey] : [];

  const totals: Record<
    string,
    { amount: number; config: Ingredient; sales: number; carryOver: number }
  > = {};

  // Обработка продаж
  salesData.data.forEach(sale => {
    if (!sale.planogram?.name || sale.planogram.name.toLowerCase() === 'item') return;

    const quantity = sale.number;
    const ingredients = sale.planogram.ingredients;

    if (ingredients && ingredients.length > 0) {
      ingredients.forEach(apiIngredient => {
        const config = getIngredientConfig(apiIngredient.name, machine?.model);
        if (config) {
          const key = config.name;
          const amount = apiIngredient.volume * quantity;

          if (!totals[key]) {
            totals[key] = { amount: 0, config, sales: 0, carryOver: 0 };
          }
          totals[key].amount += amount;
          totals[key].sales += amount;
        }
      });
    } else {
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
        };
      }
      totals[key].amount += quantity;
      totals[key].sales += quantity;
    }
  });

  // Обработка переносов
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
        };
      }
      
      totals[key].amount += override.carryOver;
      totals[key].carryOver = override.carryOver;
    }
  });

  const allItems: ShoppingListItem[] = []; // ← ВОТ ТАК ДОЛЖНО БЫТЬ ОПРЕДЕЛЕНО!

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
      planogramName: null,
      amount: Math.ceil(Math.max(0, displayAmount)),
      unit: displayUnit,
      status: overrides[`${machineId}-${key}`]?.status || 'none',
      salesAmount: Math.ceil(salesDisplayAmount),
      previousDeficit: Math.ceil(deficitDisplayAmount),
      isCore: !!modelKey && coreIngredientConfigs.some(c => c.name === data.config.name),
      type: data.config.type || 'auto',
      syrupOptions: data.config.syrupOptions,
      checked: false,
    });
  });

  // Сортируем
  allItems.sort((a, b) => {
    const aIsCore = a.isCore;
    const bIsCore = b.isCore;

    if (aIsCore && !bIsCore) return -1;
    if (!aIsCore && bIsCore) return 1;

    if (aIsCore && bIsCore) {
      const indexA = coreIngredientConfigs.findIndex(c => c.name === a.name);
      const indexB = coreIngredientConfigs.findIndex(c => c.name === b.name);
      return indexA - indexB;
    }

    return a.name.localeCompare(b.name, 'ru');
  });

  const finalResult = allItems; // из старой логики
  console.log('Итоговый результат (старая логика):', finalResult.length);
  return finalResult;
};