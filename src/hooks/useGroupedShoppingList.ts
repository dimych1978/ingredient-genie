import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import type { TelemetronSaleItem, ShoppingListItem } from '@/types/telemetron';
import { useTelemetronApi } from './useTelemetronApi';
import {
  allMachines,
  getMachineType,
  getIngredientConfig,
} from '@/lib/data';

export const useGroupedShoppingList = () => {
  const [loading, setLoading] = useState(false);
  const [groupedList, setGroupedList] = useState<ShoppingListItem[]>([]);
  const { getSalesByProducts } = useTelemetronApi();

  const calculateGroupedShoppingList = useCallback(
    async (
      machineIds: string[],
      dateFrom: Date
    ): Promise<ShoppingListItem[]> => {
      if (machineIds.length === 0) {
        return [];
      }

      setLoading(true);

      try {
        const allSales: TelemetronSaleItem[] = [];
        const dateTo = new Date();

        // 1. Собираем ВСЕ продажи со ВСЕХ аппаратов
        for (const vmId of machineIds) {
          try {
            const salesData = await getSalesByProducts(
              vmId,
              format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
              format(dateTo, 'yyyy-MM-dd HH:mm:ss')
            );

            if (salesData?.data) {
              allSales.push(...salesData.data);
            }
          } catch (error) {
            console.error(`Ошибка для аппарата ${vmId}:`, error);
          }
        }

        console.log('📊 Всего продаж со всех аппаратов:', allSales.length);

        // 2. Группируем по типам аппаратов для правильной обработки
        const machineGroups = {
          coffee: machineIds.filter(id => {
            const machine = allMachines.find(m => m.id === id);
            return machine && getMachineType(machine) === 'coffee';
          }),
          snack: machineIds.filter(id => {
            const machine = allMachines.find(m => m.id === id);
            return machine && getMachineType(machine) === 'snack';
          }),
          bottle: machineIds.filter(id => {
            const machine = allMachines.find(m => m.id === id);
            return machine && getMachineType(machine) === 'bottle';
          }),
        };

        // 3. Обрабатываем кофейные ингредиенты
        const coffeeIngredients = new Map<
          string,
          {
            amount: number;
            unit: string;
            type: string;
          }
        >();

        // 4. Обрабатываем снеки
        const snackItems = new Map<
          string,
          {
            amount: number;
            unit: string;
            name: string;
          }
        >();

        // 5. Обрабатываем продажи
        allSales.forEach(sale => {
          if (!sale.planogram?.name) return;

          const machine = allMachines.find(
            m => m.id === sale.product_number?.split('-')[0]
          );
          const machineType = machine ? getMachineType(machine) : 'snack';

          // КОФЕЙНЫЕ аппараты: преобразуем напитки → ингредиенты
          if (machineType === 'coffee' && sale.planogram.ingredients) {
            sale.planogram.ingredients.forEach(ingredient => {
              const config = getIngredientConfig(
                ingredient.name,
                machine
              );
              if (config) {
                const key = config.name;
                const current = coffeeIngredients.get(key) || {
                  amount: 0,
                  unit: config.unit,
                  type: config.type,
                };
                current.amount += ingredient.volume * sale.number;
                coffeeIngredients.set(key, current);
              }
            });
          }
          // СНЕКИ и БУТМАТЫ: учитываем как есть
          else {
            const key = sale.planogram.name;
            const current = snackItems.get(key) || {
              amount: 0,
              unit: 'шт',
              name: sale.planogram.name,
            };
            current.amount += sale.number;
            snackItems.set(key, current);
          }
        });

        // 6. Формируем итоговый список
        const result: ShoppingListItem[] = [];

        // Кофейные ингредиенты
        coffeeIngredients.forEach((data, name) => {
          result.push({
            name,
            amount: Math.ceil(data.amount),
            unit: data.unit,
            status: 'none',
            salesAmount: Math.ceil(data.amount),
            isCore: false,
            type: data.type as any,
            planogramName: name,
          });
        });

        // Снеки и бутматы
        snackItems.forEach((data, name) => {
          result.push({
            name,
            amount: Math.ceil(data.amount),
            unit: data.unit,
            status: 'none',
            salesAmount: Math.ceil(data.amount),
            isCore: false,
            type: 'auto',
            planogramName: name,
          });
        });

        // 7. Сортируем: сначала кофейные ингредиенты, потом снеки по алфавиту
        result.sort((a, b) => {
          const aIsCoffee = coffeeIngredients.has(a.name);
          const bIsCoffee = coffeeIngredients.has(b.name);

          if (aIsCoffee && !bIsCoffee) return -1;
          if (!aIsCoffee && bIsCoffee) return 1;

          return a.name.localeCompare(b.name, 'ru');
        });

        console.log('✅ Групповой список создан:', result.length, 'позиций');
        setGroupedList(result);
        return result;
      } catch (error) {
        console.error('❌ Ошибка создания группового списка:', error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [getSalesByProducts]
  );

  return {
    loading,
    groupedList,
    calculateGroupedShoppingList,
  };
};
