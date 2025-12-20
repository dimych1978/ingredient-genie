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
    ingredients: item.planogram.ingredients || [] // Превращаем null в пустой массив
  },
  number: item.number
});

// Нормализация названий для аппаратов Kikko
const normalizeIngredientName = (ingredientName: string): string => {
  const mappings: Record<string, string> = {
    'Стакан пластиковый': 'Стаканчик',
    'Размешиватель, 105 мм': 'Размешиватель',
    // Добавьте другие маппинги по мере необходимости
  };
  
  return mappings[ingredientName] || ingredientName;
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
      return i; // Возвращаем индекс как приоритет
    }
  }
  return COFFEE_GROUP_INGREDIENTS.length; // Все остальное идет после
};


export const calculateShoppingList = (
  salesData: { data: TelemetronSaleItem[] }, 
  sort: SortType = 'grouped',
  overrides: LoadingOverrides = {},
  machineId: string
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
    
    // Если статус 'partial' и есть данные о прошлой загрузке
    if (override.status === 'partial' && override.requiredAmount && override.loadedAmount !== undefined) {
      const shortfall = override.requiredAmount - override.loadedAmount;
      
      if (shortfall > 0) {
        if (!totals[ingredientName]) {
          // Если по этому ингредиенту не было продаж, но был недогруз
           const unitCode = ingredientName.toLowerCase().includes('кофе') ? 3 : 1; // Простое предположение
           totals[ingredientName] = { amount: 0, unitCode };
        }
        totals[ingredientName].amount += shortfall;
      }
    }
  });


  // 4. Конвертируем в ShoppingListItem[]
  const list = Object.entries(totals).map(([name, data]) => {
    // Не отображаем товары, которые были полностью пополнены в прошлый раз
    const override = overrides[`${machineId}-${name}`];
    if (override && override.status === 'full') {
        return null;
    }

    const { unit, displayAmount } = getDisplayUnit(data.unitCode, data.amount);
    
    return {
      name,
      amount: Math.ceil(displayAmount), // Округляем до целого в большую сторону
      unit
    };
  }).filter((item): item is ShoppingListItem => item !== null); // Убираем null элементы

  // 5. Сортируем
  if (sort === 'alphabetical') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } else { // 'grouped'
    list.sort((a, b) => {
      const priorityA = getSortPriority(a.name);
      const priorityB = getSortPriority(b.name);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  return list;
};
