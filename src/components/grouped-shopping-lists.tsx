//grouped-shopping-lists.tsx
'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import { readAllOverrides } from '@/app/actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { TelemetronSaleItem } from '@/types/telemetron';
import { allMachines, getIngredientConfig, getMachineType } from '@/lib/data';

interface GroupedShoppingListsProps {
  machineIds: string[];
  specialMachineDates: Record<string, string>;
  onSaveChanges: () => void;
  aaMachineIds: Set<string>;
}

// Упрощенный тип для внутреннего использования
type CombinedListItem = {
  name: string;
  amount: number;
  unit: string;
  isCoffeeIngredient: boolean;
};

export const GroupedShoppingLists = ({
  machineIds,
  specialMachineDates,
  onSaveChanges,
  aaMachineIds,
}: GroupedShoppingListsProps) => {
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [combinedList, setCombinedList] = useState<CombinedListItem[]>([]);

  const { getMachineOverview, getSalesByProducts } = useTelemetronApi();

  const handleGenerateClick = useCallback(async () => {
    if (showList) {
      setShowList(false);
      return;
    }

    setLoading(true);
    setCombinedList([]);

    const machineIdsToProcess = machineIds.filter(id => !aaMachineIds.has(id));

    if (machineIdsToProcess.length > 0) {
      onSaveChanges();
    }

    try {
      // 1. Собрать все правильные даты начала
      const allDates: Record<string, string> = { ...specialMachineDates };
      const dateTo = new Date();

      const overviewPromises = machineIdsToProcess
        .filter(id => !allDates[id])
        .map(async id => {
          try {
            const overview = await getMachineOverview(id);
            const lastCollection = overview.data?.cache?.last_collection_at;
            if (lastCollection) {
              allDates[id] = lastCollection;
            }
          } catch (e) {
            console.error(`Ошибка получения overview для ${id}:`, e);
          }
        });

      await Promise.all(overviewPromises);

      // 2. Загрузить все продажи с правильными датами, дополнив их machineId
      const allSales: (TelemetronSaleItem & { machineId: string })[] = [];
      const salesPromises = machineIdsToProcess.map(async id => {
        const dateFrom = allDates[id];
        if (dateFrom) {
          try {
            const salesData = await getSalesByProducts(
              id,
              format(new Date(dateFrom), 'yyyy-MM-dd HH:mm:ss'),
              format(dateTo, 'yyyy-MM-dd HH:mm:ss')
            );
            if (salesData.data) {
              const machineSales = salesData.data.map(
                (sale: TelemetronSaleItem) => ({
                  ...sale,
                  machineId: id,
                })
              );
              allSales.push(...machineSales);
            }
          } catch (e) {
            console.error(`Ошибка получения продаж для ${id}:`, e);
          }
        }
      });

      await Promise.all(salesPromises);

      // 3. Загрузить все оверрайды
      const allOverrides = await readAllOverrides();

      // 4. Сгруппировать и посчитать
      const coffeeIngredientsMap = new Map<
        string,
        { amount: number; unit: string }
      >();
      const productMap = new Map<string, { amount: number; unit: string }>();

      // Обработка продаж
      allSales.forEach(sale => {
        if (!sale.planogram?.name) return;

        const machine = allMachines.find(m => m.id === sale.machineId);
        const machineType = machine ? getMachineType(machine) : 'snack';

        if (
          machineType === 'coffee' &&
          sale.planogram.ingredients &&
          sale.planogram.ingredients.length > 0
        ) {
          // Если продажа кофейного напитка, раскладываем на ингредиенты
          sale.planogram.ingredients.forEach(apiIngredient => {
            const config = getIngredientConfig(
              apiIngredient.name,
              machine?.model
            );
            if (config) {
              const current = coffeeIngredientsMap.get(config.name) || {
                amount: 0,
                unit: config.unit,
              };
              current.amount += apiIngredient.volume * sale.number;
              coffeeIngredientsMap.set(config.name, current);
            }
          });
        } else {
          // Если продажа снека или бутылки
          const name = sale.planogram.name;
          const current = productMap.get(name) || { amount: 0, unit: 'шт' };
          current.amount += sale.number;
          productMap.set(name, current);
        }
      });

      // Обработка оверрайдов
      for (const key in allOverrides) {
        const override = allOverrides[key];
        const machineIdFromFile = key.split('-')[0];

        if (machineIdsToProcess.includes(machineIdFromFile)) {
          const name = key.substring(machineIdFromFile.length + 1);
          const carryOver = override.carryOver || 0;

          // Проверяем, это ингредиент или продукт
          const ingredientConfig = getIngredientConfig(name);
          if (ingredientConfig) {
            const current = coffeeIngredientsMap.get(ingredientConfig.name) || {
              amount: 0,
              unit: ingredientConfig.unit,
            };
            current.amount += carryOver;
            coffeeIngredientsMap.set(ingredientConfig.name, current);
          } else {
            const current = productMap.get(name) || { amount: 0, unit: 'шт' };
            current.amount += carryOver;
            productMap.set(name, current);
          }
        }
      }

      // 5. Финальный расчет и формирование списка
      const finalList: CombinedListItem[] = [];

      coffeeIngredientsMap.forEach((value, name) => {
        const totalAmount = Math.ceil(Math.max(0, value.amount));
        if (totalAmount > 0) {
          finalList.push({
            name: name,
            amount: totalAmount,
            unit: value.unit,
            isCoffeeIngredient: true,
          });
        }
      });

      productMap.forEach((value, name) => {
        const totalAmount = Math.ceil(Math.max(0, value.amount));
        if (totalAmount > 0) {
          finalList.push({
            name: name,
            amount: totalAmount,
            unit: value.unit,
            isCoffeeIngredient: false,
          });
        }
      });

      // 6. Сортировка: сначала кофейные, потом остальные по алфавиту
      finalList.sort((a, b) => {
        if (a.isCoffeeIngredient && !b.isCoffeeIngredient) {
          return -1;
        }
        if (!a.isCoffeeIngredient && b.isCoffeeIngredient) {
          return 1;
        }
        return a.name.localeCompare(b.name, 'ru');
      });

      setCombinedList(finalList);
    } catch (error) {
      console.error('Ошибка при формировании общего списка:', error);
    } finally {
      setLoading(false);
      setShowList(true);
    }
  }, [
    machineIds,
    specialMachineDates,
    onSaveChanges,
    getMachineOverview,
    getSalesByProducts,
    showList,
    aaMachineIds,
  ]);

  const machineIdsToProcessCount = machineIds.filter(
    id => !aaMachineIds.has(id)
  ).length;

  return (
    <div className='space-y-6'>
      <Card className='bg-muted/20'>
        <CardHeader>
          <CardTitle>Формирование общего заказа</CardTitle>
          <CardDescription>
            {machineIds.length > 0
              ? `Нажмите, чтобы создать сводный список по ${machineIdsToProcessCount} аппаратам (за исключением аппаратов без планограммы).`
              : 'Сначала добавьте аппараты в список выше.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGenerateClick}
            className='w-full'
            disabled={machineIdsToProcessCount === 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Формирование...
              </>
            ) : showList ? (
              'Скрыть общий заказ'
            ) : (
              'Сформировать общий заказ'
            )}
          </Button>
        </CardContent>
      </Card>

      {showList && combinedList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Общий заказ</CardTitle>
            <CardDescription>
              Сводный список на основе продаж и остатков для{' '}
              {machineIdsToProcessCount} апп.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead className='text-right'>Количество</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedList.map(item => (
                  <TableRow key={item.name}>
                    <TableCell className='font-medium'>{item.name}</TableCell>
                    <TableCell className='text-right'>
                      {item.amount} {item.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {showList && !loading && combinedList.length === 0 && (
        <p className='text-muted-foreground text-center py-4'>
          Нет товаров для заказа за выбранные периоды.
        </p>
      )}
    </div>
  );
};
