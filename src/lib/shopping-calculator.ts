//shopping-calculator.ts
import type {
  TelemetronSaleItem,
  TelemetronIngredient,
  LoadingOverrides,
  ShoppingListItem,
} from '@/types/telemetron';
import {
  allMachines,
  machineIngredients,
  getIngredientConfig,
  type Machine,
  type Ingredient,
} from './data';

export type SortType = 'grouped' | 'alphabetical';

const normalizeForPlanogramComparison = (name: string): string => {
  return name
    .replace(/["«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
  machineModel?: string
): ShoppingListItem[] => {
  const machine = allMachines.find(m => m.id === machineId);
  
  const lowerMachineModel = machine?.model?.toLowerCase();

  const matchingKeys = lowerMachineModel 
    ? Object.keys(machineIngredients).filter(key => lowerMachineModel.includes(key.toLowerCase()))
    : [];

  matchingKeys.sort((a, b) => b.length - a.length);

  const modelKey = matchingKeys.length > 0 ? matchingKeys[0] : undefined;

  const coreIngredientConfigs = modelKey ? machineIngredients[modelKey] : [];

  const totals: Record<
    string,
    { amount: number; config: Ingredient; sales: number; carryOver: number }
  > = {};

  // 1. Обработка продаж из API
  salesData.data.forEach(sale => {
    if (
      !sale.planogram ||
      !sale.planogram.name ||
      sale.planogram.name.toLowerCase() === 'item'
    ) {
      return;
    }

    const quantity = sale.number;
    const ingredients = sale.planogram.ingredients;

    if (ingredients && ingredients.length > 0) {
      // Кофейный напиток
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
      // Снек или бутылка
      const config = getIngredientConfig(sale.planogram.name, machine?.model);
      const key = config ? config.name : sale.planogram.name;
      if (!totals[key]) {
        totals[key] = {
          amount: 0,
          config: config || { name: key, unit: 'шт', type: 'manual', apiNames: [key] },
          sales: 0,
          carryOver: 0,
        };
      }
      totals[key].amount += quantity;
      totals[key].sales += quantity;
    }
  });

  // 2. Обработка переносов (overrides) - теперь учитывает и излишки (отрицательное значение)
  Object.keys(overrides).forEach(overrideKey => {
    if (!overrideKey.startsWith(`${machineId}-`)) return;

    const itemNameFromOverride = overrideKey.replace(`${machineId}-`, '');
    if (itemNameFromOverride.toLowerCase() === 'item') return;

    const override = overrides[overrideKey];
    if (override.carryOver) { // Проверяем само наличие carryOver
      const config = getIngredientConfig(itemNameFromOverride, machine?.model);
      const key = config ? config.name : itemNameFromOverride;

      if (!totals[key]) {
        totals[key] = {
          amount: 0,
          config: config || { name: key, unit: 'шт', type: 'manual', apiNames: [key] },
          sales: 0,
          carryOver: 0,
        };
      }
      // Просто прибавляем carryOver. Если он отрицательный (излишек), он вычтется.
      totals[key].amount += override.carryOver;
      totals[key].carryOver += override.carryOver;
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
    
    // Показываем в списке, если есть продажи, или есть перенос, или требуется > 0
    if (displayAmount > 0 || data.sales > 0 || data.carryOver !== 0) {
      allItems.push({
        name: data.config.name,
        amount: Math.ceil(Math.max(0, displayAmount)), // Не может быть нужно отрицательное количество
        unit: displayUnit,
        status: overrides[`${machineId}-${key}`]?.status || 'none',
        salesAmount: Math.ceil(salesDisplayAmount),
        previousDeficit: Math.ceil(deficitDisplayAmount), // Теперь это может быть и излишек (отрицательное число)
        isCore: !!modelKey && coreIngredientConfigs.some(c => c.name === data.config.name)
      });
    }
  });

  // 4. Сортируем
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

    // Сортировка снеков по планограмме
    if (planogram && planogram.length > 0) {
      const indexA = planogram.findIndex(p => normalizeForPlanogramComparison(p) === normalizeForPlanogramComparison(a.name));
      const indexB = planogram.findIndex(p => normalizeForPlanogramComparison(p) === normalizeForPlanogramComparison(b.name));
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
    }
    
    return a.name.localeCompare(b.name, 'ru');
  });

  return allItems;
};
