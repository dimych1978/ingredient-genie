import type { TelemetronSaleItem, TelemetronIngredient, LoadingOverride, LoadingOverrides } from '@/types/telemetron';
import { machineIngredients } from './data';

export interface ShoppingListItem {
  name: string;
  amount: number;
  unit: string;
}

export type SortType = 'grouped' | 'alphabetical';

interface AdaptedSaleItem {
  product_number: string;
  planogram: {
    name: string;
    ingredients: TelemetronIngredient[];
  };
  number: number;
}

const adaptSaleItem = (item: TelemetronSaleItem): AdaptedSaleItem => ({
  product_number: item.product_number,
  planogram: {
    name: item.planogram.name,
    ingredients: item.planogram.ingredients || []
  },
  number: item.number
});

const normalizeIngredientName = (name: string): string => {
  const mappings: Record<string, string> = {
    'Стакан пластиковый': 'Стаканчик',
    'Размешиватель, 105 мм': 'Размешиватель',
  };
  
  const lowerName = name.toLowerCase();
  
  // Круассаны Яшкино
  if (lowerName.includes('круассан') && lowerName.includes('яшкино')) {
    return 'Круассан Яшкино / Чудо / Степ';
  }
  
  // Пирожное basker wheels панкейк
  if (lowerName.includes('пирожное') && lowerName.includes('панкейк')) {
    return 'Пирожное basker wheels панкейк 36гр/ Соломка';
  }
  
  return mappings[name] || name;
};

const normalizeForPlanogramComparison = (name: string): string => {
  return name
    .replace(/["«»"']/g, '') // Убираем ВСЕ кавычки полностью
    .replace(/\s+/g, ' ')    // Множественные пробелы -> один пробел
    .trim()                  // Убираем пробелы по краям
    .toLowerCase();          // В нижний регистр
};

const getDisplayUnit = (unitCode: number, amount: number): { unit: string; displayAmount: number } => {
  switch (unitCode) {
    case 2:
      if (amount >= 1000) return { unit: 'л', displayAmount: amount / 1000 };
      return { unit: 'мл', displayAmount: amount };
    case 3:
      if (amount >= 1000) return { unit: 'кг', displayAmount: amount / 1000 };
      return { unit: 'г', displayAmount: amount };
    default:
      return { unit: 'шт', displayAmount: amount };
  }
};

const findBestPlanogramMatch = (itemName: string, normalizedPlanogram: string[]): number => {
  const normalizedItem = normalizeForPlanogramComparison(itemName);
  const exactIndex = normalizedPlanogram.indexOf(normalizedItem);
  if (exactIndex !== -1) return exactIndex;
  
  for (let i = 0; i < normalizedPlanogram.length; i++) {
    const planogramItem = normalizedPlanogram[i];
    if (normalizedItem.includes(planogramItem) || planogramItem.includes(normalizedItem)) {
      return i;
    }
  }
  
  return -1;
};

const sortForKikko = (
  list: ShoppingListItem[],
  planogram?: string[]
): ShoppingListItem[] => {
  const ingredients = machineIngredients.kikko;
  
  const coffeeItems: ShoppingListItem[] = [];
  const snackItems: ShoppingListItem[] = [];
  
  list.forEach(item => {
    const itemLower = item.name.toLowerCase();
    const itemName = item.name;
    
    // Проверяем конфликты: чай и шоколад
    const isSnackChocolate = /^шоколад\s+[а-яё]/i.test(itemName) || 
                            /^шоколад,\s+[а-яё]/i.test(itemName);
    
    const isSnackTea = /^чай\s+[а-яё]/i.test(itemName) || 
                      /^чай,\s+[а-яё]/i.test(itemName);
    
    // Минеральная вода - это снек
    const isMineralWater = itemLower.includes('минеральн') || 
                          itemLower.includes('минерал') ||
                          itemLower.includes('черноголовка') ||
                          itemLower.includes('норма жизни');
    
    if (isSnackChocolate || isSnackTea || isMineralWater) {
      snackItems.push(item);
      return;
    }
    
    // Проверяем кофейные ингредиенты
    let isCoffeeItem = false;
    
    for (const ing of ingredients) {
      const ingLower = ing.name.toLowerCase();
      
      if (ingLower === 'вода') {
        if (itemLower === 'вода') {
          isCoffeeItem = true;
          break;
        }
      } else if (itemLower.includes(ingLower)) {
        isCoffeeItem = true;
        break;
      }
    }
    
    if (isCoffeeItem) {
      coffeeItems.push(item);
    } else {
      snackItems.push(item);
    }
  });
  
  // Сортируем кофейные ингредиенты по порядку
  coffeeItems.sort((a, b) => {
    let indexA = -1;
    let indexB = -1;
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    
    for (let i = 0; i < ingredients.length; i++) {
      const ingLower = ingredients[i].name.toLowerCase();
      
      if (aLower.includes(ingLower)) indexA = i;
      if (bLower.includes(ingLower)) indexB = i;
    }
    
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.name.localeCompare(b.name, 'ru');
  });
  
  // Сортируем снеки по планограмме
  if (planogram && snackItems.length > 0) {
    const normalizedPlanogramArray = planogram.map(normalizeForPlanogramComparison);
    
    snackItems.sort((a, b) => {
      const matchA = findBestPlanogramMatch(a.name, normalizedPlanogramArray);
      const matchB = findBestPlanogramMatch(b.name, normalizedPlanogramArray);
      
      if (matchA !== -1 && matchB !== -1) return matchA - matchB;
      if (matchA !== -1) return -1;
      if (matchB !== -1) return 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  } else {
    snackItems.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
  
  return [...coffeeItems, ...snackItems];
};

const sortRegularList = (
  list: ShoppingListItem[],
  planogram?: string[]
): ShoppingListItem[] => {
  if (planogram && planogram.length > 0) {
    const normalizedPlanogram = planogram.map(normalizeForPlanogramComparison);
    
    list.sort((a, b) => {
      const matchA = findBestPlanogramMatch(a.name, normalizedPlanogram);
      const matchB = findBestPlanogramMatch(b.name, normalizedPlanogram);
      
      if (matchA !== -1 && matchB !== -1) return matchA - matchB;
      if (matchA !== -1) return -1;
      if (matchB !== -1) return 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
  
  return list;
};

export const calculateShoppingList = (
  salesData: { data: TelemetronSaleItem[] }, 
  sort: SortType = 'grouped',
  overrides: LoadingOverrides = {},
  machineId: string,
  planogram?: string[],
  machineModel?: string
): ShoppingListItem[] => {
  const adaptedData = salesData.data.map(adaptSaleItem);
  const totals: Record<string, { amount: number; unitCode: number }> = {};

  adaptedData.forEach(sale => {
    const quantity = sale.number;
    
    if (sale.planogram.ingredients.length > 0) {
      sale.planogram.ingredients.forEach(ingredient => {
        // Нормализуем название ингредиента
        const normalizedName = normalizeIngredientName(ingredient.name);
        const amount = ingredient.volume * quantity;
        
        if (!totals[normalizedName]) {
          totals[normalizedName] = { amount: 0, unitCode: ingredient.unit };
        }
        totals[normalizedName].amount += amount;
      });
    } else {
      // Нормализуем название продукта
      const productName = normalizeIngredientName(sale.planogram.name);
      if (!totals[productName]) {
        totals[productName] = { amount: 0, unitCode: 1 };
      }
      totals[productName].amount += quantity;
    }
  });
  
  Object.keys(overrides).forEach(key => {
    if (!key.startsWith(`${machineId}-`)) return;

    const override: LoadingOverride = overrides[key];
    const ingredientName = key.replace(`${machineId}-`, '');
    
    if (override.status === 'partial' && override.requiredAmount && override.loadedAmount !== undefined) {
      const shortfall = override.requiredAmount - override.loadedAmount;
      
      if (shortfall > 0) {
        if (!totals[ingredientName]) {
          const unitCode = ingredientName.toLowerCase().includes('кофе') ? 3 : 1;
          totals[ingredientName] = { amount: 0, unitCode };
        }
        totals[ingredientName].amount += shortfall;
      }
    }
  });

  const list = Object.entries(totals).map(([name, data]) => {
    const override = overrides[`${machineId}-${name}`];
    if (override && override.status === 'full') {
      return null;
    }

    const { unit, displayAmount } = getDisplayUnit(data.unitCode, data.amount);
    
    return {
      name,
      amount: Math.ceil(displayAmount),
      unit
    };
  }).filter((item): item is ShoppingListItem => item !== null);

  const lowerModel = machineModel?.toLowerCase();
  
  if (lowerModel?.includes('kikko')) {
    return sortForKikko(list, planogram);
  } else {
    return sortRegularList(list, planogram);
  }
};