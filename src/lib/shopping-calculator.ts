import type { TelemetronSaleItem, TelemetronIngredient } from '@/types/telemetron';

export interface ShoppingListItem {
  name: string;
  amount: number;
  unit: string;
}

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

export const calculateShoppingList = (salesData: { data: TelemetronSaleItem[] }): ShoppingListItem[] => {
  // 1. Адаптируем и фильтруем данные
  const adaptedData = salesData.data
    .map(adaptSaleItem)
    .filter(item => item.planogram.ingredients.length > 0);
  
  if (adaptedData.length === 0) return [];
  
  // 2. Считаем totals
  const totals: Record<string, number> = {};

  adaptedData.forEach(sale => {
    const quantity = sale.number;
    
    sale.planogram.ingredients.forEach(ingredient => {
      const normalizedName = normalizeIngredientName(ingredient.name);
      const amount = ingredient.volume * quantity;
      totals[normalizedName] = (totals[normalizedName] || 0) + amount;
    });
  });
  
  // 3. Конвертируем в ShoppingListItem[]
  return Object.entries(totals).map(([name, amount]) => {
    // Находим единицу измерения из первого попавшегося ингредиента
    const sampleIngredient = adaptedData
      .flatMap(sale => sale.planogram.ingredients)
      .find(ing => normalizeIngredientName(ing.name) === name);
    
    const { unit, displayAmount } = getDisplayUnit(
      sampleIngredient?.unit || 1,
      amount
    );
    
    return {
      name,
      amount: Math.round(displayAmount * 100) / 100, // Округление до 2 знаков
      unit
    };
  });
};