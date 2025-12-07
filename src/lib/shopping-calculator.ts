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
  // 1. Адаптируем данные
  const adaptedData = salesData.data.map(adaptSaleItem);
  
  if (adaptedData.length === 0) return [];
  
  // 2. Считаем totals
  const totals: Record<string, { amount: number; unitCode: number }> = {};

  adaptedData.forEach(sale => {
    const quantity = sale.number;
    
    // Если есть ингредиенты (напитки)
    if (sale.planogram.ingredients.length > 0) {
      sale.planogram.ingredients.forEach(ingredient => {
        const normalizedName = normalizeIngredientName(ingredient.name);
        const amount = ingredient.volume * quantity;
        
        if (!totals[normalizedName]) {
          totals[normalizedName] = { amount: 0, unitCode: ingredient.unit };
        }
        totals[normalizedName].amount += amount;
      });
    } 
    // Если ингредиентов нет (снеки, бутылки)
    else {
      const productName = sale.planogram.name;
      if (!totals[productName]) {
        totals[productName] = { amount: 0, unitCode: 1 }; // unitCode 1 = штуки
      }
      totals[productName].amount += quantity;
    }
  });
  
  // 3. Конвертируем в ShoppingListItem[]
  return Object.entries(totals).map(([name, data]) => {
    const { unit, displayAmount } = getDisplayUnit(data.unitCode, data.amount);
    
    return {
      name,
      amount: Math.round(displayAmount * 100) / 100, // Округление до 2 знаков
      unit
    };
  });
};
