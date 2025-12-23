//shopping-calculator.ts
import type { TelemetronSaleItem, TelemetronIngredient, LoadingOverride, LoadingOverrides, ShoppingListItem, LoadingStatus } from '@/types/telemetron';
import { machineIngredients } from './data';

// export interface ShoppingListItem {
//   name: string;
//   amount: number;
//   unit: string;
// }

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

const getDisplayUnit = (unitCode: number, amount: number, 
  ingredientName: string,
  machineModel?: string): { unit: string; displayAmount: number } => {
    const lowerName = ingredientName.toLowerCase();
  if (lowerName.includes('капучино') && lowerName.includes('ваниль')) {
    // 1 порция = 10г (стандарт для капучино-ваниль)
    const GRAMS_PER_PORTION = 10;
    return { 
      unit: 'шт', 
      displayAmount: Math.ceil(amount / GRAMS_PER_PORTION) 
    };
  }
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
  console.log('=== DEBUG sortForKikko START ===');
  console.log('Всего элементов:', list.length);
  console.log('Планограмма для аппарата:', planogram);
  
  const ingredients = machineIngredients.kikko;
  console.log('Кофейные ингредиенты для Kikko из machineIngredients:', ingredients.map(i => i.name));
  
  const coffeeItems: ShoppingListItem[] = [];
  const snackItems: ShoppingListItem[] = [];
  
  // РАЗДЕЛЕНИЕ НА КОФЕЙНЫЕ И СНЕКИ
  list.forEach(item => {
    const itemLower = item.name.toLowerCase();
    const itemName = item.name;
    
    console.log(`Обрабатываем: "${item.name}"`);
    
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
      console.log(`  -> Определили как СНЕК (специальный случай)`);
      snackItems.push(item);
      return;
    }
    
    // Проверяем кофейные ингредиенты
    let isCoffeeItem = false;
    
    for (const ing of ingredients) {
      const ingLower = ing.name.toLowerCase();
      
      // Особый случай для воды
      if (ingLower === 'вода') {
        if (itemLower === 'вода' || itemLower === 'вода для кофе') {
          isCoffeeItem = true;
          console.log(`  -> Определили как КОФЕЙНЫЙ (вода)`);
          break;
        }
      } else if (itemLower.includes(ingLower)) {
        isCoffeeItem = true;
        console.log(`  -> Определили как КОФЕЙНЫЙ (${ing.name})`);
        break;
      }
    }
    
    if (isCoffeeItem) {
      coffeeItems.push(item);
    } else {
      console.log(`  -> Определили как СНЕК (по умолчанию)`);
      snackItems.push(item);
    }
  });
  
  console.log('Кофейные элементы:', coffeeItems.length, 'штук:', coffeeItems.map(c => c.name));
  console.log('Снеки:', snackItems.length, 'штук:', snackItems.map(s => s.name));
  
  // СОРТИРОВКА КОФЕЙНЫХ ЭЛЕМЕНТОВ
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
  
  console.log('Отсортированные кофейные элементы:', coffeeItems.map(c => c.name));
  
  // СОРТИРОВКА СНЕКОВ ПО ПЛАНОГРАММЕ
  if (planogram && snackItems.length > 0) {
    console.log('=== Начинаем сортировку снеков по планограмме ===');
    
    const normalizedPlanogram = planogram.map(p => 
      p.toLowerCase().replace(/["«»"']/g, '').trim()
    );
    console.log('Нормализованная планограмма:', normalizedPlanogram);
    
    snackItems.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      console.log(`Сравниваем снеки: "${a.name}" и "${b.name}"`);
      
      // Ищем в планограмме
      let indexA = -1;
      let indexB = -1;
      
      for (let i = 0; i < normalizedPlanogram.length; i++) {
        const planogramItem = normalizedPlanogram[i];
        
        // Проверяем разные варианты совпадения
        if (aName.includes(planogramItem) || planogramItem.includes(aName)) {
          indexA = i;
          console.log(`  "${a.name}" найдено в планограмме на позиции ${i}: "${planogramItem}"`);
        }
        if (bName.includes(planogramItem) || planogramItem.includes(bName)) {
          indexB = i;
          console.log(`  "${b.name}" найдено в планограмме на позиции ${i}: "${planogramItem}"`);
        }
      }
      
      if (indexA !== -1 && indexB !== -1) {
        console.log(`  Результат сортировки: ${indexA - indexB} (оба в планограмме)`);
        return indexA - indexB;
      }
      if (indexA !== -1) {
        console.log(`  Результат сортировки: -1 (только "${a.name}" в планограмме)`);
        return -1;
      }
      if (indexB !== -1) {
        console.log(`  Результат сортировки: 1 (только "${b.name}" в планограмме)`);
        return 1;
      }
      
      console.log(`  Результат сортировки: алфавит (ничего не найдено в планограмме)`);
      return a.name.localeCompare(b.name, 'ru');
    });
    
    console.log('Отсортированные снеки:', snackItems.map(s => s.name));
  } else {
    console.log('Нет планограммы или нет снеков - сортируем по алфавиту');
    snackItems.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
  
  const result = [...coffeeItems, ...snackItems];
  console.log('=== DEBUG sortForKikko END ===');
  console.log('Финальный отсортированный список:', result.map(r => r.name));
  
  return result;
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
  if (salesData.data.length === 0) {
  // Проверяем есть ли переносы
  const hasCarryOvers = Object.keys(overrides).some(key => 
    key.startsWith(`${machineId}-`) && overrides[key]?.carryOver && overrides[key]?.carryOver > 0
  );
  
  if (!hasCarryOvers) {
    return []; // Пустой список
  }
}
  
  const adaptedData = salesData.data.map(adaptSaleItem);
  const totals: Record<string, { amount: number; unitCode: number }> = {};
  const salesOnly: Record<string, number> = {}; // Только продажи (без переноса)

  // Считаем ТОЛЬКО продажи
  adaptedData.forEach(sale => {
    const quantity = sale.number;
    
    if (sale.planogram.ingredients.length > 0) {
      sale.planogram.ingredients.forEach(ingredient => {
        const normalizedName = normalizeIngredientName(ingredient.name);
        const amount = ingredient.volume * quantity;
        
        if (!totals[normalizedName]) {
          totals[normalizedName] = { amount: 0, unitCode: ingredient.unit };
          salesOnly[normalizedName] = 0;
        }
        totals[normalizedName].amount += amount;
        salesOnly[normalizedName] += amount;
      });
    } else {
      const productName = normalizeIngredientName(sale.planogram.name);
      if (!totals[productName]) {
        totals[productName] = { amount: 0, unitCode: 1 };
        salesOnly[productName] = 0;
      }
      totals[productName].amount += quantity;
      salesOnly[productName] += quantity;
    }
  });
  
  // Добавляем переносы с прошлого раза
  Object.keys(overrides).forEach(key => {
    if (!key.startsWith(`${machineId}-`)) return;

    const override: LoadingOverride = overrides[key];
    const ingredientName = key.replace(`${machineId}-`, '');
    
    // Если был перенос (carryOver > 0) - добавляем к текущим продажам
    if (override.carryOver && override.carryOver > 0) {
      if (!totals[ingredientName]) {
        // Если сейчас нет продаж, но был перенос - создаем запись
        const unitCode = ingredientName.toLowerCase().includes('кофе') ? 3 : 1;
        totals[ingredientName] = { amount: 0, unitCode };
        salesOnly[ingredientName] = 0;
      }
      totals[ingredientName].amount += override.carryOver;
    }
  });

  const list = Object.entries(totals).map(([name, data]) => {
    const override = overrides[`${machineId}-${name}`];
    const salesAmount = salesOnly[name] || 0;
    
    const { unit, displayAmount } = getDisplayUnit(
      data.unitCode, 
      data.amount, 
      name,
      machineModel
    );

    // Если продаж нет и не было переноса - полностью пополнено
    if (salesAmount === 0 && (!override || override.carryOver === 0)) {
      return {
        name,
        amount: 0,
        unit,
        status: 'none' as LoadingStatus,
        salesAmount: 0,
        previousDeficit: 0
      };
    }

    // Определяем previousDeficit из override
    const previousDeficit = override?.carryOver || 0;
    
    return {
      name,
      amount: Math.ceil(displayAmount),
      unit,
      status: override?.status || 'none',
      salesAmount: Math.ceil(salesAmount / (data.unitCode === 3 ? 1000 : 1)), // Конвертируем в display единицы
      previousDeficit: Math.ceil(previousDeficit / (data.unitCode === 3 ? 1000 : 1))
    };
  }).filter(item => item !== null);

  const lowerModel = machineModel?.toLowerCase();
  
  if (lowerModel?.includes('kikko')) {
    return sortForKikko(list, planogram);
  } else {
    return sortRegularList(list, planogram);
  }
};