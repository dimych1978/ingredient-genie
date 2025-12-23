//shopping-list.tsx
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import {
  calculateShoppingList,
  type SortType,
} from '@/lib/shopping-calculator';
import type {
  TelemetronSalesResponse,
  TelemetronSaleItem,
  LoadingStatus,
  LoadingOverrides,
  ShoppingListItem,
} from '@/types/telemetron';
import {
  getLoadingOverrides,
  saveLoadingOverrides,
  setSpecialMachineDate,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Loader2,
  ShoppingCart,
  Calendar,
  Download,
  Check,
  X,
  Minus,
  Save,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { allMachines, isSpecialMachine, planograms } from '@/lib/data';

interface EditableShoppingListItem extends ShoppingListItem {
  status: 'none' | 'partial';
  loadedAmount?: number;
  salesAmount?: number;
  previousDeficit?: number;
}

interface ShoppingListProps {
  machineIds: string[];
  title?: string;
  description?: string;
  showControls?: boolean;
  forceLoad?: boolean;
  specialMachineDates?: Record<string, string>;
  onDateChange?: (date: Date) => void;
  onTimestampUpdate?: (newTimestamp: string) => void;
  sort?: SortType;
  markAsServiced: boolean;
}

export const ShoppingList = ({
  machineIds: initialMachineIds,
  title = 'Shopping List',
  description,
  showControls = true,
  forceLoad = false,
  specialMachineDates = {},
  onDateChange,
  onTimestampUpdate,
  sort = 'grouped',
  markAsServiced,
}: ShoppingListProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shoppingList, setShoppingList] = useState<EditableShoppingListItem[]>(
    []
  );

  const [machineIds, setMachineIds] = useState<string[]>(initialMachineIds);
  const [loadedAmounts, setLoadedAmounts] = useState<number[]>([]);

  interface DisplayShoppingListItem extends ShoppingListItem {
    previousDeficit?: number;
    salesAmount?: number;
  }

  const machineIdsString = useMemo(() => machineIds.join(', '), [machineIds]);

  const dateFrom = useMemo(() => {
    const machineDateStr = specialMachineDates[machineIds[0]];
    return machineDateStr ? new Date(machineDateStr) : new Date();
  }, [specialMachineDates, machineIds]);

  const { getSalesByProducts, getMachineOverview } = useTelemetronApi();
  const { toast } = useToast();

  useEffect(() => {
    setMachineIds(initialMachineIds);
  }, [initialMachineIds]);

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (onDateChange) onDateChange(newDate);
  };

  const handleMachineIdsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ids = e.target.value
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
    setMachineIds(ids);
  };

  const loadShoppingList = useCallback(async () => {
    if (machineIds.length === 0) {
      if (forceLoad) {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не указаны ID аппаратов.',
        });
      }
      return;
    }
    setLoading(true);
    setShoppingList([]);

    try {
      const allSales: TelemetronSaleItem[] = [];
      const dateTo = new Date();

      const machineOverrides: LoadingOverrides =
        machineIds.length === 1 ? await getLoadingOverrides(machineIds[0]) : {};

      for (const vmId of machineIds) {
        try {
          let startDate: Date;
          const isSpecial = isSpecialMachine(
            allMachines?.find(m => m.id === vmId)
          );

          if (isSpecial && specialMachineDates[vmId]) {
            startDate = new Date(specialMachineDates[vmId]);
          } else {
            const machineOverview = await getMachineOverview(vmId);
            startDate = machineOverview?.data?.cache?.last_collection_at
              ? new Date(machineOverview.data.cache.last_collection_at)
              : dateFrom;
          }

          const dateFromStr = format(startDate, 'yyyy-MM-dd HH:mm:ss');
          const dateToStr = format(dateTo, 'yyyy-MM-dd HH:mm:ss');

          const salesData: TelemetronSalesResponse = await getSalesByProducts(
            vmId,
            dateFromStr,
            dateToStr
          );

          if (salesData?.data) allSales.push(...salesData.data);

          const machineData = allMachines.find(m => m.id === vmId);
          const machineModel = machineData?.model?.toLowerCase();

          const planogram =
            machineIds.length === 1 ? planograms[machineIds[0]] : undefined;

          const calculatedList = calculateShoppingList(
            { data: allSales },
            sort,
            machineOverrides,
            machineIds[0],
            planogram,
            machineModel
          );

          const editableList = calculatedList.map(item => {
            const overrideKey = `${machineIds[0]}-${item.name}`;
            const override = machineOverrides[overrideKey];
            return {
              ...item,
              status: override?.status || 'none',
              loadedAmount: override?.loadedAmount,
            };
          });

          setShoppingList(editableList);

          if (calculatedList.length === 0 && allSales.length > 0) {
            toast({
              variant: 'default',
              title: 'Нет продаж',
              description: 'За выбранный период продаж не найдено.',
            });
          }
        } catch (e) {
          console.error(`Ошибка для аппарата ${vmId}:`, e);
          toast({
            variant: 'destructive',
            title: `Ошибка для аппарата ${vmId}`,
            description:
              e instanceof Error ? e.message : 'Не удалось загрузить данные.',
          });
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки shopping list:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось сформировать список.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    machineIds,
    getSalesByProducts,
    getMachineOverview,
    toast,
    specialMachineDates,
    sort,
    dateFrom,
  ]);

  useEffect(() => {
    if (forceLoad) {
      loadShoppingList();
    }
  }, [forceLoad, machineIdsString, dateFrom]);

  const handleStatusChange = (index: number, status: 'none' | 'partial') => {
    const item = shoppingList[index];

    setShoppingList(prev =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              status,
              loadedAmount:
                status === 'partial' ? item.loadedAmount || 1 : undefined,
            }
          : item
      )
    );

    // Обновляем loadedAmounts
    if (status === 'partial') {
      setLoadedAmounts(prev => {
        const newAmounts = [...prev];
        // Ставим минимальное значение или предыдущее
        newAmounts[index] = item.loadedAmount || 1;
        return newAmounts;
      });
    } else {
      setLoadedAmounts(prev => {
        const newAmounts = [...prev];
        newAmounts[index] = 0;
        return newAmounts;
      });
    }
  };

  const handlePartialAmountChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    setLoadedAmounts(prev => {
      const newAmounts = [...prev];
      newAmounts[index] = numValue;
      return newAmounts;
    });

    // Обновляем loadedAmount в основном списке
    setShoppingList(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, loadedAmount: numValue } : item
      )
    );
  };

  // const handlePartialAmountChange = (index: number, value: string) => {
  //   const numValue = Math.max(0, parseInt(value) || 0);

  //   // Обновляем массив loadedAmounts
  //   setLoadedAmounts(prev => {
  //     const newAmounts = [...prev];
  //     newAmounts[index] = numValue;
  //     return newAmounts;
  //   });

  //   // Также обновляем loadedAmount в shoppingList
  //   setShoppingList(prev => prev.map((item, i) =>
  //     i === index ? {
  //       ...item,
  //       loadedAmount: numValue,
  //       status: 'partial' // Автоматически ставим статус partial при вводе
  //     } : item
  //   ));
  // };

  useEffect(() => {
    if (shoppingList.length > 0) {
      // Инициализируем loadedAmounts значениями из shoppingList
      const initialLoadedAmounts = shoppingList.map(
        item => item.loadedAmount || 0
      );
      setLoadedAmounts(initialLoadedAmounts);
    }
  }, [shoppingList]);

  const handleSaveOverrides = async () => {
    if (machineIds.length > 1) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Сохранение статусов доступно только для одного аппарата.',
      });
      return;
    }

    setSaving(true);
    const machineId = machineIds[0];

    try {
      const overridesToSave: LoadingOverrides = {};

      // Сохраняем ВСЕ элементы, у которых есть статус (partial или none)
      shoppingList.forEach(item => {
        const key = `${machineId}-${item.name}`;

        // Сохраняем если есть статус И (есть продажи ИЛИ есть перенос)
        const hasSalesOrCarryOver =
          (item.salesAmount && item.salesAmount > 0) ||
          (item.previousDeficit && item.previousDeficit > 0);

        if (item.status && hasSalesOrCarryOver) {
          // Используем loadedAmount из состояния loadedAmounts
          const loadedAmount = loadedAmounts[shoppingList.indexOf(item)] || 0;

          overridesToSave[key] = {
            status: item.status,
            requiredAmount: item.amount,
            loadedAmount: item.status === 'partial' ? loadedAmount : 0,
          };
        }
      });

      // Получаем текущие override'ы и обновляем только нужные
      const currentOverrides = await getLoadingOverrides(machineId);
      const updatedOverrides = { ...currentOverrides };

      // Обновляем или добавляем новые
      Object.keys(overridesToSave).forEach(key => {
        updatedOverrides[key] = overridesToSave[key];
      });

      // Удаляем override'ы для позиций, которых нет в текущем списке или продаж нет
      Object.keys(currentOverrides).forEach(key => {
        const itemName = key.replace(`${machineId}-`, '');
        const existsInCurrentList = shoppingList.some(
          item =>
            item.name === itemName &&
            ((item.salesAmount && item.salesAmount > 0) ||
              (item.previousDeficit && item.previousDeficit > 0))
        );

        if (!existsInCurrentList) {
          delete updatedOverrides[key];
        }
      });

      const result = await saveLoadingOverrides(updatedOverrides);

      const machine = allMachines.find(m => m.id === machineId);

      if (machine && isSpecialMachine(machine)) {
        const now = new Date();
        const newTimestamp = now.toISOString();

        // Сохраняем новую дату инкассации
        const result = await setSpecialMachineDate(machineId, newTimestamp);

        if (result.success && onTimestampUpdate) {
          onTimestampUpdate(newTimestamp);
          toast({
            title: 'Дата инкассации обновлена',
            description: `Теперь продажи будут считаться с ${format(
              new Date(newTimestamp),
              'dd.MM.yyyy HH:mm'
            )}`,
          });
        }
      }
      // if (isSpecialMachine(machineId)) {
      //   const now = new Date();
      //   const newTimestamp = now.toISOString();
      //   await setSpecialMachineDate(machineId, newTimestamp);
      //   if (onTimestampUpdate) {
      //     onTimestampUpdate(newTimestamp);
      //   }
      // }

      if (result.success) {
        toast({
          title: 'Сохранено',
          description: 'Состояние загрузки успешно сохранено.',
        });
      } else {
        throw new Error('Не удалось сохранить данные на сервере.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description:
          error instanceof Error ? error.message : 'Неизвестная ошибка.',
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadList = () => {
    const periodStr = `${format(dateFrom, 'dd.MM.yyyy HH:mm')}-Сейчас`;
    const header = `${title}\nПериод: ${periodStr}\nАппараты: ${machineIdsString}\n\n`;

    const itemsText = shoppingList
      .map(
        (item, index) =>
          `${index + 1}. ${item.name}: ${item.amount} ${item.unit}`
      )
      .join('\n');

    const fileContent = header + itemsText;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-list-${machineIds.join('-')}-${periodStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className='w-full bg-gray-900 border-gray-700 text-white'>
      <CardHeader className='border-b border-gray-700'>
        <CardTitle className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <ShoppingCart className='h-5 w-5 text-yellow-400' />
            {title}
          </div>
          {shoppingList.length > 0 && (
            <div className='text-sm font-normal text-gray-300'>
              {shoppingList.length} позиций
            </div>
          )}
        </CardTitle>
        {description && (
          <p className='text-gray-400 text-sm pt-2'>{description}</p>
        )}
      </CardHeader>

      <CardContent className='p-4 space-y-4'>
        {showControls && (
          <div className='space-y-4'>
            {!forceLoad && (
              <>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-800 rounded-lg'>
                  {machineIds.length > 1 && (
                    <div className='md:col-span-2'>
                      <Label
                        htmlFor='vmIds'
                        className='block text-sm text-gray-400 mb-1'
                      >
                        ID аппаратов (через запятую)
                      </Label>
                      <Input
                        id='vmIds'
                        value={machineIdsString}
                        onChange={handleMachineIdsChange}
                        className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white'
                        placeholder='58690, 40680'
                      />
                    </div>
                  )}
                  <div className='md:col-span-2'>
                    <Label
                      htmlFor='dateFrom'
                      className='block text-sm text-gray-400 mb-1'
                    >
                      Дата начала периода
                    </Label>
                    <div className='flex items-center gap-2'>
                      <Calendar className='h-4 w-4 text-gray-400' />
                      <Input
                        id='dateFrom'
                        type='date'
                        value={format(dateFrom, 'yyyy-MM-dd')}
                        onChange={handleDateInputChange}
                        className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white'
                      />
                    </div>
                  </div>
                </div>
                <Button
                  onClick={loadShoppingList}
                  disabled={loading}
                  className='w-full bg-yellow-600 hover:bg-yellow-700 text-white'
                >
                  {loading ? (
                    <Loader2 className='animate-spin mr-2' />
                  ) : (
                    <ShoppingCart className='mr-2 h-4 w-4' />
                  )}
                  {loading ? 'Загружаем...' : 'Создать Shopping List'}
                </Button>
              </>
            )}
          </div>
        )}

        {loading && (
          <div className='text-center py-8'>
            <Loader2 className='animate-spin h-8 w-8 text-yellow-400 mx-auto mb-3' />
            <div className='text-gray-400'>
              Загружаем данные и формируем список...
            </div>
          </div>
        )}

        {shoppingList.length > 0 && (
          <div className='space-y-3'>
            <div className='flex gap-3'>
              {machineIds.length === 1 && (
                <Button
                  onClick={handleSaveOverrides}
                  variant='outline'
                  className='border-green-600 text-green-300 hover:bg-green-900/50 flex-1'
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className='animate-spin mr-2 h-4 w-4' />
                  ) : (
                    <Save className='mr-2 h-4 w-4' />
                  )}
                  Сохранить состояние
                </Button>
              )}
              <Button
                onClick={downloadList}
                variant='outline'
                className='border-gray-600 text-gray-300 hover:bg-gray-800 flex-1'
              >
                <Download className='mr-2 h-4 w-4' />
                Скачать список
              </Button>
            </div>

            <div className='grid gap-2'>
              <TooltipProvider>
                {shoppingList.map((item, index) => {
                  const displayItem = item as DisplayShoppingListItem;
                  const isFullyReplenished = displayItem.salesAmount === 0;
                  const hasCarryOver =
                    displayItem.previousDeficit &&
                    displayItem.previousDeficit > 0;

                  return (
                    <div
                      key={index}
                      className={cn(
                        'flex justify-between items-center p-3 border rounded-lg',
                        isFullyReplenished
                          ? 'bg-green-900/20 border-green-600 text-green-300'
                          : displayItem.status === 'none'
                          ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300'
                          : 'bg-blue-900/20 border-blue-600 text-blue-300'
                      )}
                    >
                      <div className='flex-1 space-y-1'>
                        <div className='font-medium'>{displayItem.name}</div>

                        {/* Информация о продажах */}
                        {displayItem.salesAmount &&
                          displayItem.salesAmount > 0 && (
                            <div className='text-sm text-gray-400'>
                              Продажи:{' '}
                              {displayItem.salesAmount.toLocaleString('ru-RU')}{' '}
                              {displayItem.unit}
                              {displayItem.name.toLowerCase() === 'вода' &&
                                displayItem.salesAmount < 1 && (
                                  <span className='text-xs'>
                                    {' '}
                                    (в мл:{' '}
                                    {(
                                      displayItem.salesAmount * 1000
                                    ).toLocaleString('ru-RU')}
                                    )
                                  </span>
                                )}
                            </div>
                          )}

                        {/* Информация о переносе */}
                        {hasCarryOver && (
                          <div className='text-sm text-orange-400'>
                            Перенос с прошлого раза:{' '}
                            {displayItem.previousDeficit!.toLocaleString(
                              'ru-RU'
                            )}{' '}
                            {displayItem.unit}
                          </div>
                        )}

                        {/* ИТОГО */}
                        <div
                          className={cn(
                            'text-base font-bold',
                            isFullyReplenished ? 'text-green-400' : 'text-white'
                          )}
                        >
                          {isFullyReplenished
                            ? 'Пополнено полностью'
                            : `Нужно: ${displayItem.amount.toLocaleString(
                                'ru-RU'
                              )} ${displayItem.unit}`}
                        </div>
                      </div>

                      {/* Кнопки управления только если есть продажи и не полностью пополнено */}
                      {!isFullyReplenished && (
                        <div className='flex items-center gap-1'>
                          {/* "Не пополнено" */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className={cn(
                                  'rounded-full',
                                  displayItem.status === 'none' &&
                                    'bg-red-500/20 text-red-400'
                                )}
                                onClick={() =>
                                  handleStatusChange(index, 'none')
                                }
                              >
                                <X className='h-5 w-5' />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Не пополнено</p>
                            </TooltipContent>
                          </Tooltip>

                          {/* "Частично пополнено" */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className={cn(
                                  'rounded-full',
                                  displayItem.status === 'partial' &&
                                    'bg-yellow-500/20 text-yellow-400'
                                )}
                                onClick={() =>
                                  handleStatusChange(index, 'partial')
                                }
                              >
                                <Minus className='h-5 w-5' />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Пополнено частично</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}

                      {/* Поле для ввода загруженного количества */}
                      {displayItem.status === 'partial' &&
                        !isFullyReplenished && (
                          <div className='ml-2 w-24'>
                            <Input
                              type='number'
                              value={loadedAmounts[index] ?? ''}
                              onChange={e =>
                                handlePartialAmountChange(index, e.target.value)
                              }
                              placeholder='Кол-во'
                              className='bg-gray-700 border-gray-600 text-white h-9'
                              min={displayItem.previousDeficit || 0}
                            />
                          </div>
                        )}
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
