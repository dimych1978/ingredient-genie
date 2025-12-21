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
} from '@/types/telemetron';
import { getLoadingOverrides, saveLoadingOverrides } from '@/app/actions';
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

// Расширяем интерфейс для внутреннего использования в компоненте
interface EditableShoppingListItem {
  name: string;
  amount: number;
  unit: string;
  status: LoadingStatus;
  loadedAmount?: number; 
}

interface ShoppingListProps {
  machineIds: string[];
  title?: string;
  description?: string;
  showControls?: boolean;
  forceLoad?: boolean;
  specialMachineDates?: Record<string, string>;
  onDateChange?: (date: string) => void;
  sort?: SortType;
}

export const ShoppingList = ({
  machineIds: initialMachineIds,
  title = 'Shopping List',
  description,
  showControls = true,
  forceLoad = false,
  specialMachineDates = {},
  onDateChange,
  sort = 'grouped',
}: ShoppingListProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shoppingList, setShoppingList] = useState<EditableShoppingListItem[]>(
    []
  );
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const machineDate = specialMachineDates[initialMachineIds[0]];
    if (machineDate) return new Date(machineDate);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });

  const [machineIds, setMachineIds] = useState<string[]>(initialMachineIds);
  const machineIdsString = useMemo(() => machineIds.join(', '), [machineIds]);

  const { getSalesByProducts, getMachineOverview } = useTelemetronApi();
  const { toast } = useToast();

  useEffect(() => {
    setMachineIds(initialMachineIds);
    const machineDate = specialMachineDates[initialMachineIds[0]];
    if (machineDate) {
      setDateFrom(new Date(machineDate));
    }
  }, [initialMachineIds, specialMachineDates]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    setDateFrom(newDate);
    if (onDateChange) onDateChange(newDate.toISOString());
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
          if (specialMachineDates[vmId]) {
            startDate = new Date(specialMachineDates[vmId]);
          } else {
            const machineOverview = await getMachineOverview(vmId);
            startDate = machineOverview?.data?.cache?.last_collection_at
              ? new Date(machineOverview.data.cache.last_collection_at)
              : dateFrom;
          }

          const dateFromStr = format(startDate, "yyyy-MM-dd'T'00:00:00.000");
          const dateToStr = format(dateTo, "yyyy-MM-dd'T'23:59:59.999");

          const salesData: TelemetronSalesResponse = await getSalesByProducts(
            vmId,
            dateFromStr,
            dateToStr
          );
          if (salesData?.data) allSales.push(...salesData.data);
        } catch (e) {
          console.error(`Ошибка загрузки продаж для аппарата ${vmId}:`, e);
          toast({
            variant: 'destructive',
            title: `Ошибка для аппарата ${vmId}`,
            description:
              e instanceof Error ? e.message : 'Не удалось загрузить данные.',
          });
        }
      }

      const calculatedList = calculateShoppingList(
        { data: allSales },
        sort,
        machineOverrides,
        machineIds[0]
      );

      const editableList: EditableShoppingListItem[] = calculatedList.map(
        item => {
          const overrideKey = `${machineIds[0]}-${item.name}`;
          const override = machineOverrides[overrideKey];
          return {
            ...item,
            status: override?.status || 'pending',
            loadedAmount: override?.loadedAmount,
          };
        }
      );

      setShoppingList(editableList);

      if (calculatedList.length === 0 && allSales.length > 0) {
        toast({
          variant: 'default',
          title: 'Нет продаж',
          description: 'За выбранный период продаж не найдено.',
        });
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
    dateFrom,
    specialMachineDates,
    sort,
    forceLoad,
  ]);

  useEffect(() => {
    if (forceLoad) {
      loadShoppingList();
    }
  }, [forceLoad, machineIdsString, dateFrom, loadShoppingList]);

  const handleStatusChange = (index: number, status: LoadingStatus) => {
    const newList = [...shoppingList];
    const currentItem = newList[index];
    currentItem.status = status;

    // Если пополнено полностью, устанавливаем loadedAmount равным требуемому
    if (status === 'full') {
      currentItem.loadedAmount = currentItem.amount;
    } else if (status !== 'partial') {
      // Для 'none' и 'pending' сбрасываем loadedAmount
      delete currentItem.loadedAmount;
    }
    setShoppingList(newList);
  };

  const handlePartialAmountChange = (index: number, amount: string) => {
    const newList = [...shoppingList];
    newList[index].loadedAmount = Number(amount);
    setShoppingList(newList);
  };

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
    const overridesToSave: LoadingOverrides = {};

    // Создаем копию текущих оверрайдов, чтобы не потерять старые записи
    const currentOverrides = await getLoadingOverrides(machineId);

    shoppingList.forEach(item => {
      const key = `${machineId}-${item.name}`;
      if (item.status !== 'pending') {
        overridesToSave[key] = {
          status: item.status,
          // Сохраняем и amount (требуемое) и loadedAmount (загруженное)
          requiredAmount: item.amount,
          loadedAmount: item.loadedAmount,
        };
      } else {
        // Если статус сброшен в pending, удаляем оверрайд
        if (currentOverrides[key]) {
          delete currentOverrides[key];
        }
      }
    });

    try {
      // Сливаем старые и новые оверрайды
      const result = await saveLoadingOverrides({
        ...currentOverrides,
        ...overridesToSave,
      });
      if (result.success) {
        toast({
          title: 'Сохранено',
          description: 'Состояние загрузки ингредиентов успешно сохранено.',
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
    const periodStr = `${format(dateFrom, 'dd.MM.yyyy')}-Today`;
    const header = `${title}\nПериод: ${periodStr}\nАппараты: ${machineIdsString}\n\n`;

    const itemsText = shoppingList
      .map(
        (item, index) =>
          `${index + 1}. ${item.name}: ${item.amount} ${item.unit}`
      )
      .join('\n');

    const text = header + itemsText;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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
                        onChange={handleDateChange}
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
                {shoppingList.map((item, index) => (
                  <div
                    key={index}
                    className='flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-lg'
                  >
                    <div className='flex-1 space-y-1'>
                      <div className='font-medium'>{item.name}</div>
                      <div className='text-base text-green-400'>
                        Нужно:{' '}
                        <span className='font-bold'>
                          {item.amount.toLocaleString('ru-RU')}
                        </span>{' '}
                        {item.unit}
                      </div>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                              'rounded-full',
                              item.status === 'full' &&
                                'bg-green-500/20 text-green-400'
                            )}
                            onClick={() => handleStatusChange(index, 'full')}
                          >
                            <Check className='h-5 w-5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Пополнено полностью</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                              'rounded-full',
                              item.status === 'none' &&
                                'bg-red-500/20 text-red-400'
                            )}
                            onClick={() => handleStatusChange(index, 'none')}
                          >
                            <X className='h-5 w-5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Не пополнено</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                              'rounded-full',
                              item.status === 'partial' &&
                                'bg-yellow-500/20 text-yellow-400'
                            )}
                            onClick={() => handleStatusChange(index, 'partial')}
                          >
                            <Minus className='h-5 w-5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Пополнено частично</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {item.status === 'partial' && (
                      <div className='ml-2 w-24'>
                        <Input
                          type='number'
                          value={item.loadedAmount ?? ''}
                          onChange={e =>
                            handlePartialAmountChange(index, e.target.value)
                          }
                          placeholder='Кол-во'
                          className='bg-gray-700 border-gray-600 text-white h-9'
                        />
                      </div>
                    )}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
