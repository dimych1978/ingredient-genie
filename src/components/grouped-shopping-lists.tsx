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
import { Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { TelemetronSaleItem } from '@/types/telemetron';
import {
  allMachines,
  getIngredientConfig,
  getMachineType,
  GroupedShoppingListsProps,
} from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

type CombinedListItem = {
  name: string;
  amount: number;
  unit: string;
  isCoffeeIngredient: boolean;
  breakdown: Record<string, { name: string; amount: number }>;
};

export const GroupedShoppingLists = ({
  machineIds,
  specialMachineDates,
  aaMachineIds,
  stockOnHand,
  onStockChange,
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

    try {
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
      const allOverrides = await readAllOverrides();

      const coffeeIngredientsMap = new Map<
        string,
        {
          amount: number;
          unit: string;
          breakdown: Record<string, { name: string; amount: number }>;
        }
      >();
      const productMap = new Map<
        string,
        {
          amount: number;
          unit: 'шт';
          breakdown: Record<string, { name: string; amount: number }>;
        }
      >();

      allSales.forEach(sale => {
        if (!sale.planogram?.name) return;

        const machine = allMachines.find(m => m.id === sale.machineId);
        if (!machine) return;

        if (
          sale.planogram.ingredients &&
          sale.planogram.ingredients.length > 0
        ) {
          sale.planogram.ingredients.forEach(apiIngredient => {
            const config = getIngredientConfig(
              apiIngredient.name,
              machine?.model
            );
            if (config) {
              const current = coffeeIngredientsMap.get(config.name) || {
                amount: 0,
                unit: config.unit,
                breakdown: {},
              };
              const amountToAdd = apiIngredient.volume * sale.number;
              current.amount += amountToAdd;
              const machineBreakdown = current.breakdown[sale.machineId] || {
                name: machine.name,
                amount: 0,
              };
              machineBreakdown.amount += amountToAdd;
              current.breakdown[sale.machineId] = machineBreakdown;
              coffeeIngredientsMap.set(config.name, current);
            }
          });
        }
        else {
          const name = sale.planogram.name;
          const current = productMap.get(name) || {
            amount: 0,
            unit: 'шт',
            breakdown: {},
          };
          const amountToAdd = sale.number;
          current.amount += amountToAdd;
          const machineBreakdown = current.breakdown[sale.machineId] || {
            name: machine.name,
            amount: 0,
          };
          machineBreakdown.amount += amountToAdd;
          current.breakdown[sale.machineId] = machineBreakdown;
          productMap.set(name, current);
        }
      });

      for (const key in allOverrides) {
        const override = allOverrides[key];
        const machineIdFromFile = key.split('-')[0];

        if (machineIdsToProcess.includes(machineIdFromFile)) {
          const name = key.substring(machineIdFromFile.length + 1);
          let carryOver = override.carryOver || 0;

          const machine = allMachines.find(m => m.id === machineIdFromFile);
          if (!machine) continue;

          if (
            name.toLowerCase() === 'вода' &&
            getMachineType(machine) === 'coffee' &&
            carryOver < 0
          ) {
            carryOver = 0;
          }

          const ingredientConfig = getIngredientConfig(name, machine?.model);
          if (ingredientConfig) {
            const current = coffeeIngredientsMap.get(ingredientConfig.name) || {
              amount: 0,
              unit: ingredientConfig.unit,
              breakdown: {},
            };
            current.amount += carryOver;
            const machineBreakdown =
              current.breakdown[machineIdFromFile] || {
                name: machine.name,
                amount: 0,
              };
            machineBreakdown.amount += carryOver;
            current.breakdown[machineIdFromFile] = machineBreakdown;
            coffeeIngredientsMap.set(ingredientConfig.name, current);
          } else {
            const current = productMap.get(name) || {
              amount: 0,
              unit: 'шт',
              breakdown: {},
            };
            current.amount += carryOver;
            const machineBreakdown =
              current.breakdown[machineIdFromFile] || {
                name: machine.name,
                amount: 0,
              };
            machineBreakdown.amount += carryOver;
            current.breakdown[machineIdFromFile] = machineBreakdown;
            productMap.set(name, current);
          }
        }
      }

      const finalList: CombinedListItem[] = [];

      coffeeIngredientsMap.forEach((value, name) => {
        const totalAmount = Math.ceil(Math.max(0, value.amount));
        if (totalAmount > 0) {
          finalList.push({
            name: name,
            amount: totalAmount,
            unit: value.unit,
            isCoffeeIngredient: true,
            breakdown: value.breakdown,
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
            breakdown: value.breakdown,
          });
        }
      });

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
    getMachineOverview,
    getSalesByProducts,
    showList,
    aaMachineIds,
  ]);

  const machineIdsToProcessCount = machineIds.filter(
    id => !aaMachineIds.has(id)
  ).length;

  return (
    <div className="space-y-6">
      <Card className="bg-muted/20">
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
            className="w-full"
            disabled={machineIdsToProcessCount === 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <CardContent className="px-1 sm:px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-1 py-2 sm:px-2">Название</TableHead>
                  <TableHead className="px-1 py-2 sm:px-2 text-right whitespace-nowrap">
                    Кол-во
                  </TableHead>
                  <TableHead className="px-1 py-2 sm:px-2 w-10 text-right">Инфо</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedList.map(item => (
                  <TableRow key={item.name}>
                    <TableCell className="px-1 py-2 sm:px-2 font-medium min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <Input
                          type="number"
                          value={stockOnHand[item.name] || ''}
                          onChange={e =>
                            onStockChange(item.name, e.target.value)
                          }
                          className="h-8 w-12 sm:w-14 text-center p-1 flex-shrink-0"
                          placeholder="0"
                        />
                        <span className="min-w-0 flex-1 break-words line-clamp-2 text-xs sm:text-sm">
                          {item.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-1 py-2 sm:px-2 text-right whitespace-nowrap text-xs sm:text-sm">
                      {item.amount} {item.unit}
                    </TableCell>
                    <TableCell className="px-1 py-2 sm:px-2 text-right">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-2">
                            <h4 className="font-medium leading-none">
                              Детализация
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Разбивка для: <strong>{item.name}</strong>
                            </p>
                          </div>
                          <div className="mt-4 space-y-1">
                            {Object.entries(item.breakdown)
                              .filter(
                                ([, details]) => Math.ceil(details.amount) !== 0
                              )
                              .map(([machineId, details]) => (
                                <div
                                  key={machineId}
                                  className="flex justify-between items-center text-sm"
                                >
                                  <span className="truncate pr-2">
                                    {details.name} (#{machineId})
                                  </span>
                                  <span className="font-mono text-right flex-shrink-0">
                                    {Math.ceil(details.amount)} {item.unit}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {showList && !loading && combinedList.length === 0 && (
        <p className="text-muted-foreground text-center py-4">
          Нет товаров для заказа за выбранные периоды.
        </p>
      )}
    </div>
  );
};
