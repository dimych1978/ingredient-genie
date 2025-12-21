import type { TelemetronSaleItem, TelemetronIngredient, LoadingOverride, LoadingOverrides } from '@/types/telemetron';

export interface ShoppingListItem {
  name: string;
  amount: number;
  unit: string;
}

export type SortType = 'grouped' | 'alphabetical';

// Адаптер для конвертации TelemetronSaleItem в внутренний формат
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

// Универсальная нормализация названий (решает проблему кавычек)
const normalizeIngredientName = (ingredientName: string): string => {
  const mappings: Record<string, string> = {
    'Стакан пластиковый': 'Стаканчик',
    'Размешиватель, 105 мм': 'Размешиватель',
  };
  
  return mappings[ingredientName] || ingredientName;
};

// Нормализация для сравнения с планограммой (унифицирует кавычки и пробелы)
const normalizeForPlanogramComparison = (name: string): string => {
  return name
    .replace(/["«»"']/g, "'")          // Все типы кавычек -> одинарные
    .replace(/\s*,\s*/g, ', ')          // Нормализуем запятые
    .replace(/\s*\/\s*/g, ' / ')        // Нормализуем слэши
    .replace(/\s+/g, ' ')               // Множественные пробелы -> один
    .replace(/(\d),(\d)/g, '$1.$2')     // Запятые в числах -> точки
    .trim()
    .toLowerCase();
};

// Определение единицы измерения
const getDisplayUnit = (unitCode: number, amount: number): { unit: string; displayAmount: number } => {
  switch (unitCode) {
    case 2: // миллилитры
      if (amount >= 1000) {
        return { unit: 'л', displayAmount: amount / 1000 };
      }
      return { unit: 'мл', displayAmount: amount };
      
    case 3: // граммы
      if (amount >= 1000) {
        return { unit: 'кг', displayAmount: amount / 1000 };
      }
      return { unit: 'г', displayAmount: amount };
      
    default: // штуки
      return { unit: 'шт', displayAmount: amount };
  }
};

const COFFEE_GROUP_INGREDIENTS = [
  'кофе',
  'сливки',
  'шоколад',
  'ваниль',
  'стаканы',
  'крышки',
  'размешиватели',
  'сахар'
];

const getSortPriority = (name: string): number => {
  const lowerName = name.toLowerCase();
  for (let i = 0; i < COFFEE_GROUP_INGREDIENTS.length; i++) {
    if (lowerName.includes(COFFEE_GROUP_INGREDIENTS[i])) {
      return i;
    }
  }
  return COFFEE_GROUP_INGREDIENTS.length;
};

// Поиск наиболее подходящего элемента планограммы для товара
const findBestPlanogramMatch = (itemName: string, normalizedPlanogram: string[]): number => {
  const normalizedItem = normalizeForPlanogramComparison(itemName);
  
  // 1. Ищем точное совпадение
  const exactIndex = normalizedPlanogram.indexOf(normalizedItem);
  if (exactIndex !== -1) return exactIndex;
  
  // 2. Ищем частичное совпадение (товар содержит часть названия из планограммы)
  for (let i = 0; i < normalizedPlanogram.length; i++) {
    const planogramItem = normalizedPlanogram[i];
    if (normalizedItem.includes(planogramItem) || planogramItem.includes(normalizedItem)) {
      return i;
    }
  }
  
  // 3. Ищем совпадение ключевых слов (первые 2-3 слова)
  const itemKeywords = normalizedItem.split(/\s+/).slice(0, 3);
  for (let i = 0; i < normalizedPlanogram.length; i++) {
    const planogramItem = normalizedPlanogram[i];
    const hasCommonKeyword = itemKeywords.some(keyword => 
      keyword.length > 3 && planogramItem.includes(keyword)
    );
    if (hasCommonKeyword) return i;
  }
  
  return -1; // Не найдено
};

export const calculateShoppingList = (
  salesData: { data: TelemetronSaleItem[] }, 
  sort: SortType = 'grouped',
  overrides: LoadingOverrides = {},
  machineId: string,
  planogram?: string[]
): ShoppingListItem[] => {
  // 1. Адаптируем данные
  const adaptedData = salesData.data.map(adaptSaleItem);
  
  // 2. Считаем totals по продажам
  const totals: Record<string, { amount: number; unitCode: number }> = {};

  adaptedData.forEach(sale => {
    const quantity = sale.number;
    
    if (sale.planogram.ingredients.length > 0) {
      sale.planogram.ingredients.forEach(ingredient => {
        const normalizedName = normalizeIngredientName(ingredient.name);
        const amount = ingredient.volume * quantity;
        
        if (!totals[normalizedName]) {
          totals[normalizedName] = { amount: 0, unitCode: ingredient.unit };
        }
        totals[normalizedName].amount += amount;
      });
    } else {
      const productName = sale.planogram.name;
      if (!totals[productName]) {
        totals[productName] = { amount: 0, unitCode: 1 };
      }
      totals[productName].amount += quantity;
    }
  });
  
  // 3. Учитываем предыдущие неполные загрузки
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

  // 4. Конвертируем в ShoppingListItem[]
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

  // 5. Сортируем
  if (planogram && planogram.length > 0) {
    // Нормализуем планограмму один раз
    const normalizedPlanogram = planogram.map(normalizeForPlanogramComparison);
    
    // Сортируем по совпадению с планограммой
    list.sort((a, b) => {
      const matchA = findBestPlanogramMatch(a.name, normalizedPlanogram);
      const matchB = findBestPlanogramMatch(b.name, normalizedPlanogram);
      
      // Оба найдены в планограмме
      if (matchA !== -1 && matchB !== -1) {
        return matchA - matchB;
      }
      // Только A найден
      if (matchA !== -1) return -1;
      // Только B найден
      if (matchB !== -1) return 1;
      
      // Ни один не найден - используем обычную сортировку
      if (sort === 'alphabetical') {
        return a.name.localeCompare(b.name, 'ru');
      } else {
        const priorityA = getSortPriority(a.name);
        const priorityB = getSortPriority(b.name);
        return priorityA !== priorityB ? priorityA - priorityB : a.name.localeCompare(b.name, 'ru');
      }
    });
  } else if (sort === 'alphabetical') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } else {
    list.sort((a, b) => {
      const priorityA = getSortPriority(a.name);
      const priorityB = getSortPriority(b.name);
      return priorityA !== priorityB ? priorityA - priorityB : a.name.localeCompare(b.name, 'ru');
    });
  }

  return list;
};