'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
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
import { Loader2, Eye, Search, X, Info, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import type { TelemetronSaleItem } from '@/types/telemetron';
import {
  allMachines,
  getIngredientConfig,
  GroupedShoppingListsProps,
  PRODUCT_GROUPS,
} from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { getMachineOverview, getSalesByProducts } = useTelemetronApi();

  const validMachineIds = useMemo(() => {
    const uniqueIds = Array.from(new Set(machineIds));
    return uniqueIds.filter(id => allMachines.some(m => m.id === id));
  }, [machineIds]);

  const machineIdsToProcess = useMemo(() => {
    return validMachineIds.filter(id => !aaMachineIds.has(id));
  }, [validMachineIds, aaMachineIds]);

  const machineIdsToProcessCount = machineIdsToProcess.length;

  const handleGenerateClick = useCallback(async () => {
    if (showList) {
      setShowList(false);
      return;
    }

    setLoading(true);
    setCombinedList([]);

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
              format(dateTo, 'yyyy-MM-dd HH:mm:ss'),
            );
            if (salesData.data) {
              const machineSales = salesData.data.map(
                (sale: TelemetronSaleItem) => ({
                  ...sale,
                  machineId: id,
                }),
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
              machine?.model,
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
        } else {
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
          if (carryOver < 0) carryOver = 0; // Игнорируем излишки в общей заявке

          const machine = allMachines.find(m => m.id === machineIdFromFile);
          if (!machine) continue;

          const ingredientConfig = getIngredientConfig(name, machine?.model);
          if (ingredientConfig) {
            const current = coffeeIngredientsMap.get(ingredientConfig.name) || {
              amount: 0,
              unit: ingredientConfig.unit,
              breakdown: {},
            };
            current.amount += carryOver;
            const machineBreakdown = current.breakdown[machineIdFromFile] || {
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
            const machineBreakdown = current.breakdown[machineIdFromFile] || {
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
    machineIdsToProcess,
    specialMachineDates,
    getMachineOverview,
    getSalesByProducts,
    showList,
  ]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return combinedList;
    const lowerQuery = searchQuery.toLowerCase();

    return combinedList.filter(item => {
      if (item.name.toLowerCase().includes(lowerQuery)) return true;

      const constituents = PRODUCT_GROUPS[item.name];
      if (
        constituents &&
        constituents.some(c => c.toLowerCase().includes(lowerQuery))
      ) {
        return true;
      }

      return false;
    });
  }, [combinedList, searchQuery]);

  const getGroupTotal = (groupName: string) => {
    const constituents = PRODUCT_GROUPS[groupName];
    if (!constituents) return stockOnHand[groupName] || '';

    return constituents
      .reduce((sum, name) => sum + (parseInt(stockOnHand[name] || '0') || 0), 0)
      .toString();
  };

  const handleGroupStockChange = (constituentName: string, value: string) => {
    if (/^\d{0,3}$/.test(value)) {
      onStockChange(constituentName, value);
    }
  };

  const handleStep = (name: string, delta: number) => {
    const current = parseInt(stockOnHand[name] || '0') || 0;
    const next = Math.max(0, current + delta);
    onStockChange(name, next.toString());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className='space-y-6'>
      <Card className='bg-muted/20'>
        <CardHeader>
          <CardTitle>Формирование общего заказа</CardTitle>
          <CardDescription>
            {validMachineIds.length > 0
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
        <Card className='relative'>
          <CardHeader className='sticky top-0 z-20 bg-background/95 backdrop-blur border-b pb-4'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
              <div>
                <CardTitle>Общий заказ</CardTitle>
                <CardDescription>
                  Сводный список для {machineIdsToProcessCount} апп.
                </CardDescription>
              </div>
              <div className='relative w-full sm:w-64'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
                <Input
                  ref={inputRef}
                  placeholder='Поиск в заявке...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='pl-9 pr-10 h-9'
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className='absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors'
                    aria-label='Очистить поиск'
                  >
                    <X className='w-4 h-4' />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className='px-1 sm:px-2'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='px-1 py-2 md:px-2'>Название</TableHead>
                  <TableHead className='px-1 py-2 md:px-2 text-right whitespace-nowrap'>
                    Кол-во
                  </TableHead>
                  <TableHead className='px-1 py-2 md:px-2 w-10 text-right'>
                    Инфо
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.map(item => {
                  const isGroup = !!PRODUCT_GROUPS[item.name];

                  return (
                    <TableRow
                      key={item.name}
                      className={cn(isGroup && 'bg-primary/5')}
                    >
                      <TableCell className='px-1 py-2 md:px-2 font-medium min-w-0'>
                        <div className='flex items-center gap-1 sm:gap-2 min-w-0'>
                          {isGroup ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className='relative cursor-pointer flex-shrink-0'>
                                  <Input
                                    value={getGroupTotal(item.name)}
                                    readOnly
                                    className='h-8 w-10 sm:w-12 text-center p-1 font-bold border-primary/30 bg-primary/10'
                                  />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className='w-80'>
                                <div className='space-y-3'>
                                  <h4 className='font-medium text-sm leading-none border-b pb-2 flex items-center gap-2'>
                                    {item.name}
                                    <Info className='h-3 w-3 text-primary' />
                                  </h4>
                                  <div className='grid gap-3'>
                                    {PRODUCT_GROUPS[item.name].map(
                                      constituent => (
                                        <div
                                          key={constituent}
                                          className='flex items-center justify-between gap-2'
                                        >
                                          <span className='text-xs text-muted-foreground leading-tight flex-1'>
                                            {constituent}
                                          </span>
                                          <div className='flex items-center gap-1'>
                                            <Button
                                              variant='outline'
                                              size='icon'
                                              className='h-7 w-7 rounded-full'
                                              onClick={() =>
                                                handleStep(constituent, -1)
                                              }
                                            >
                                              <Minus className='h-3 w-3' />
                                            </Button>
                                            <Input
                                              type='number'
                                              value={
                                                stockOnHand[constituent] || ''
                                              }
                                              onChange={e =>
                                                handleGroupStockChange(
                                                  constituent,
                                                  e.target.value,
                                                )
                                              }
                                              placeholder='0'
                                              className='h-8 w-12 text-center text-xs'
                                              inputMode='numeric'
                                            />
                                            <Button
                                              variant='outline'
                                              size='icon'
                                              className='h-7 w-7 rounded-full'
                                              onClick={() =>
                                                handleStep(constituent, 1)
                                              }
                                            >
                                              <Plus className='h-3 w-3' />
                                            </Button>
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div className='flex items-center gap-1 flex-shrink-0'>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground md:hidden'
                                onClick={() => handleStep(item.name, -1)}
                              >
                                <Minus className='h-3 w-3' />
                              </Button>
                              <Input
                                type='number'
                                value={stockOnHand[item.name] || ''}
                                onChange={e =>
                                  onStockChange(item.name, e.target.value)
                                }
                                className='h-8 w-10 sm:w-12 text-center p-1'
                                placeholder='0'
                              />
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground md:hidden'
                                onClick={() => handleStep(item.name, 1)}
                              >
                                <Plus className='h-3 w-3' />
                              </Button>
                            </div>
                          )}
                          <span className='min-w-0 flex-1 break-words line-clamp-2 text-xs sm:text-sm leading-tight'>
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='px-1 py-2 md:px-2 text-right whitespace-nowrap text-xs sm:text-sm'>
                        {item.amount} {item.unit}
                      </TableCell>
                      <TableCell className='px-1 py-2 md:px-2 text-right'>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                            >
                              <Eye className='h-4 w-4' />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className='w-80'>
                            <div className='space-y-2'>
                              <h4 className='font-medium leading-none'>
                                Детализация
                              </h4>
                              <p className='text-sm text-muted-foreground'>
                                Разбивка для: <strong>{item.name}</strong>
                              </p>
                            </div>
                            <div className='mt-4 space-y-1'>
                              {Object.entries(item.breakdown)
                                .filter(
                                  ([, details]) =>
                                    Math.ceil(details.amount) !== 0,
                                )
                                .map(([machineId, details]) => (
                                  <div
                                    key={machineId}
                                    className='flex justify-between items-center text-sm'
                                  >
                                    <span className='truncate pr-2'>
                                      {details.name} (#{machineId})
                                    </span>
                                    <span className='font-mono text-right flex-shrink-0'>
                                      {Math.ceil(details.amount)} {item.unit}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredList.length === 0 && (
              <p className='text-muted-foreground text-center py-8 text-sm'>
                Ничего не найдено по запросу "{searchQuery}"
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {showList && !loading && combinedList.length === 0 && (
        <p className='text-muted-foreground text-center py-4 text-sm'>
          Нет товаров для заказа за выбранные периоды.
        </p>
      )}
    </div>
  );
};
