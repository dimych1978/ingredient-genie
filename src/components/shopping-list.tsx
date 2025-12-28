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
  X,
  Save,
  Pencil,
  CircleCheckBig,
} from 'lucide-react';
import { format } from 'date-fns';
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

interface ShoppingListItemWithStatus extends ShoppingListItem {
  status: 'none' | 'partial';
  loadedAmount?: number;
  checked?: boolean;
  checkedType?: 'big' | 'small';
  selectedSyrups?: string[];
}

interface ShoppingListProps {
  machineIds: string[];
  title?: string;
  description?: string;
  dateFrom: Date;
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
  dateFrom,
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
  const [shoppingList, setShoppingList] = useState<
    ShoppingListItemWithStatus[]
  >([]);
  const [loadedAmounts, setLoadedAmounts] = useState<number[]>([]);
  const [machineIds, setMachineIds] = useState<string[]>(initialMachineIds);
  const machineIdsString = useMemo(() => machineIds.join(', '), [machineIds]);

  const isKreaTouch = useMemo(() => {
    const machine = allMachines.find(m => m.id === machineIds[0]);
    return machine?.model?.toLowerCase().includes('krea');
  }, [machineIds]);

  const isOpera = useMemo(() => {
    const machine = allMachines.find(m => m.id === machineIds[0]);
    return machine?.model?.toLowerCase().includes('opera');
  }, [machineIds]);

  const { getSalesByProducts, getMachineOverview } = useTelemetronApi();
  const { toast } = useToast();

  useEffect(() => {
    setMachineIds(initialMachineIds);
  }, [initialMachineIds]);

  const getKreaTouchItemType = (
    itemName: string
  ): 'normal' | 'checkbox' | 'syrup' => {
    if (!isKreaTouch) return 'normal';
    const lowerName = itemName.toLowerCase();
    const checkboxItems = ['стаканчик', 'крышка', 'размешиватель', 'сахар'];
    if (checkboxItems.some(name => lowerName.includes(name))) return 'checkbox';
    if (lowerName.includes('сироп')) return 'syrup';
    return 'normal';
  };
 
  const getOperaItemType = (
    itemName: string
  ): 'normal' | 'checkbox' => {
    if (!isOpera) return 'normal';
    const lowerName = itemName.toLowerCase();
    
    if (lowerName.includes('крышк')) return 'checkbox';
    return 'normal';
  };

  const handleCheckboxChange = (
    index: number,
    checked: boolean,
    checkedType?: string
  ) => {
    setShoppingList(prev =>
      prev.map((item, i) => (i === index ? { ...item, checked } : item))
    );
  };

  const handleSyrupChange = (index: number, syrupIds: string[]) => {
    setShoppingList(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, selectedSyrups: syrupIds } : item
      )
    );
  };

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
      const machineData = allMachines.find(m => m.id === machineIds[0]);

      for (const vmId of machineIds) {
        try {
          const startDate = dateFrom;
          // const isSpecial = isSpecialMachine(
          //   allMachines?.find(m => m.id === vmId)
          // );

          // const machineOverview = await getMachineOverview(vmId);
          // const lastCollection = machineOverview?.data?.cache
          //   ?.last_collection_at
          //   ? new Date(machineOverview.data.cache.last_collection_at)
          //   : null;

          // if (isSpecial && specialMachineDates[vmId]) {
          //   startDate = new Date(specialMachineDates[vmId]);
          // } else if (lastCollection) {
          //   // Для обычных аппаратов - используем ПОЗДНЮЮ дату из lastCollection ИЛИ dateFrom
          //   startDate = dateFrom > lastCollection ? dateFrom : lastCollection;
          // } else {
          //   const machineOverview = await getMachineOverview(vmId);
          //   startDate = machineOverview?.data?.cache?.last_collection_at
          //     ? new Date(machineOverview.data.cache.last_collection_at)
          //     : dateFrom;
          // }

          const salesData: TelemetronSalesResponse = await getSalesByProducts(
            vmId,
            format(startDate, 'yyyy-MM-dd HH:mm:ss'),
            format(dateTo, 'yyyy-MM-dd HH:mm:ss')
          );

          if (salesData?.data) allSales.push(...salesData.data);
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

      const planogram =
        machineIds.length === 1 ? planograms[machineIds[0]] : undefined;
      const calculatedList = calculateShoppingList(
        { data: allSales },
        sort,
        machineOverrides,
        machineIds[0],
        planogram,
        machineData?.model
      );

      const listWithStatus: ShoppingListItemWithStatus[] = calculatedList.map(
        item => {
          const overrideKey = `${machineIds[0]}-${item.name}`;
          const override = machineOverrides[overrideKey];
          return {
            ...item,
            status: override?.status || 'none',
            loadedAmount: item.amount,
          };
        }
      );

      setShoppingList(listWithStatus);
      setLoadedAmounts(listWithStatus.map(item => item.amount));

      if (listWithStatus.length === 0) {
        toast({
          variant: 'default',
          title: 'Нет продаж',
          description:
            'За выбранный период продаж не найдено или все пополнено.',
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
    specialMachineDates,
    sort,
    dateFrom,
  ]);

  useEffect(() => {
    if (forceLoad) loadShoppingList();
  }, [forceLoad, machineIdsString]);

  const handleStatusChange = (index: number, status: 'none' | 'partial') => {
    setShoppingList(prev =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              status,
              loadedAmount:
                status === 'partial' ? loadedAmounts[index] : undefined,
            }
          : item
      )
    );
  };

  const handleAmountChange = (index: number, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value) || 0;
    setLoadedAmounts(prev => {
      const newAmounts = [...prev];
      newAmounts[index] = numValue;
      return newAmounts;
    });
    setShoppingList(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, loadedAmount: numValue } : item
      )
    );
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

    try {
      const overridesToSave: LoadingOverrides = {};
      shoppingList.forEach((item, index) => {
        const key = `${machineId}-${item.name}`;
        if (item.status === 'none') {
          overridesToSave[key] = {
            status: 'none',
            requiredAmount: item.amount,
            loadedAmount: item.amount,
            timestamp: new Date().toISOString(),
          };
        }
      });

      const result = await saveLoadingOverrides(overridesToSave);
      const machine = allMachines.find(m => m.id === machineId);

      if (machine && (isSpecialMachine(machine) || markAsServiced)) {
        const now = new Date();
        const newTimestamp = now.toISOString();
        const dateUpdateResult = await setSpecialMachineDate(
          machineId,
          newTimestamp
        );
        if (dateUpdateResult.success && onTimestampUpdate) {
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

      if (result.success) {
        toast({
          title: 'Сохранено',
          description: 'Статус пополнения сохранен.',
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
                  Сохранить пополненные позиции
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
                  if (item.name.toLowerCase() === 'item') return null;
                  const isFullyReplenished = item.amount === 0;
                  const hasSales = item.salesAmount && item.salesAmount > 0;
                  const deficit = item.previousDeficit || 0;
                  const hasDeficit = deficit > 0;
                  const hasSurplus = deficit < 0;

                  return (
                    <div
                      key={index}
                      className={cn(
                        'flex justify-between items-center p-3 border rounded-lg',
                        isFullyReplenished
                          ? 'bg-green-900/20 border-green-600 text-green-300'
                          : item.status === 'none'
                          ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300'
                          : 'bg-blue-900/20 border-blue-600 text-blue-300'
                      )}
                    >
                      <div className='flex-1 space-y-1'>
                        <div className='font-medium capitalize'>
                          {item.name}
                        </div>

                        {(isKreaTouch &&
                          getKreaTouchItemType(item.name) === 'checkbox') ||
                        (getKreaTouchItemType(item.name) === 'syrup') || (getOperaItemType(item.name) === 'checkbox' )? (
                          // Только для чекбокс-товаров Krea-Touch: показываем только продажи
                          hasSales && (
                            <div className='text-sm text-gray-400'>
                              Продажи: {item.salesAmount} {item.unit}
                            </div>
                          )
                        ) : (
                          // Для всех остальных товаров
                          <>
                            {(hasSales || hasDeficit || hasSurplus) && (
                              <div className='text-sm text-gray-400'>
                                {hasSales &&
                                  `Продажи: ${item.salesAmount} ${item.unit}`}
                                {hasSales &&
                                  (hasDeficit || hasSurplus) &&
                                  ' + '}
                                {hasDeficit &&
                                  `Недогруз: ${deficit} ${item.unit}`}
                                {hasSurplus &&
                                  `Излишек: ${Math.abs(deficit)} ${item.unit}`}
                              </div>
                            )}
                            <div
                              className={cn(
                                'text-base font-bold',
                                isFullyReplenished
                                  ? 'text-green-400'
                                  : 'text-white'
                              )}
                            >
                              {isFullyReplenished
                                ? 'Пополнено'
                                : `Нужно: ${item.amount.toLocaleString(
                                    'ru-RU'
                                  )} ${item.unit}`}
                            </div>
                          </>
                        )}
                      </div>
                      {!isFullyReplenished && (
                        <div className='flex items-center gap-2'>
                          {(isKreaTouch &&
                          getKreaTouchItemType(item.name) === 'checkbox') || (isOpera && getOperaItemType(item.name) === 'checkbox') ? (
                            // ТОЛЬКО чекбокс для чекбокс-товаров
                            <div className='flex flex-col gap-2'>
                              {/* Если это стаканчик или крышка - показываем 2 чекбокса */}
                              {['стаканчик', 'крышка'].some(name =>
                                item.name.toLowerCase().includes(name)
                              ) ? (
                                <>
                                  <div className='flex items-center gap-2'>
                                    <button
                                      onClick={() =>
                                        handleCheckboxChange(
                                          index,
                                          !item.checked,
                                          'big'
                                        )
                                      }
                                      className='flex items-center justify-center h-6 w-6 rounded-full border-2 border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                                    >
                                      {item.checkedType === 'big' && (
                                        <CircleCheckBig className='h-4 w-4 text-green-500' />
                                      )}
                                    </button>
                                    <span
                                      className={`text-sm ${
                                        item.checkedType === 'big'
                                          ? 'text-green-500'
                                          : 'text-yellow-200'
                                      }`}
                                    >
                                      {item.checkedType === 'big'
                                        ? 'Не надо'
                                        : 'Большой'}
                                    </span>
                                  </div>

                                  <div className='flex items-center gap-2'>
                                    <button
                                      onClick={() =>
                                        handleCheckboxChange(
                                          index,
                                          !item.checked,
                                          'small'
                                        )
                                      }
                                      className='flex items-center justify-center h-6 w-6 rounded-full border-2 border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                                    >
                                      {item.checkedType === 'small' && (
                                        <CircleCheckBig className='h-4 w-4 text-green-500' />
                                      )}
                                    </button>
                                    <span
                                      className={`text-sm ${
                                        item.checkedType === 'small'
                                          ? 'text-green-500'
                                          : 'text-yellow-200'
                                      }`}
                                    >
                                      {item.checkedType === 'small'
                                        ? 'Не надо'
                                        : 'Малый'}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                // Для остальных чекбокс-товаров (размешиватель, сахар) - один чекбокс
                                <div className='flex items-center gap-2'>
                                  <button
                                    onClick={() =>
                                      handleCheckboxChange(
                                        index,
                                        !item.checked,
                                        item?.checkedType
                                      )
                                    }
                                    className='flex items-center justify-center h-6 w-6 rounded-full border-2 border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                                  >
                                    {item.checked && (
                                      <CircleCheckBig className='h-4 w-4 text-green-500' />
                                    )}
                                  </button>
                                  <span
                                    className={`text-sm ${
                                      item.checked
                                        ? 'text-green-500'
                                        : 'text-yellow-200'
                                    }`}
                                  >
                                    {item.checked ? 'Не надо' : 'Нужно'}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : isKreaTouch &&
                            getKreaTouchItemType(item.name) === 'syrup' ? ( // ТОЛЬКО селектор сиропов (без кнопок X/Pencil)
                            <div className='w-48'>
                              <div className='text-sm text-gray-300 mb-1'>
                                Выберите сиропы:
                              </div>
                              <div className='space-y-1'>
                                {[
                                  { id: 'banana', name: 'Банан' },
                                  { id: 'vanilla', name: 'Ваниль' },
                                  { id: 'coconut', name: 'Кокос' },
                                  { id: 'caramel', name: 'Карамель' },
                                ].map(syrup => {
                                  const isSelected =
                                    item.selectedSyrups?.includes(syrup.id) ||
                                    false;

                                  return (
                                    <div
                                      key={syrup.id}
                                      className='flex items-center gap-2 cursor-pointer'
                                      onClick={() => {
                                        const selectedSyrups =
                                          item.selectedSyrups || [];
                                        const newSelected = isSelected
                                          ? selectedSyrups.filter(
                                              id => id !== syrup.id
                                            )
                                          : [...selectedSyrups, syrup.id];
                                        handleSyrupChange(index, newSelected);
                                      }}
                                    >
                                      <div
                                        className={cn(
                                          'flex items-center justify-center h-5 w-5 rounded-full border-2',
                                          isSelected
                                            ? 'border-green-500 bg-green-500/10'
                                            : 'border-gray-400 hover:border-gray-300'
                                        )}
                                      >
                                        {isSelected && (
                                          <CircleCheckBig className='h-3 w-3 text-green-500' />
                                        )}
                                      </div>
                                      <span
                                        className={cn(
                                          'text-sm',
                                          isSelected
                                            ? 'text-green-300'
                                            : 'text-gray-300'
                                        )}
                                      >
                                        {syrup.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className={cn(
                                      'rounded-full',
                                      item.status === 'none' &&
                                        'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    )}
                                    onClick={() =>
                                      handleStatusChange(index, 'none')
                                    }
                                  >
                                    <X className='h-5 w-5' />
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
                                      item.status === 'partial' &&
                                        'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                    )}
                                    onClick={() =>
                                      handleStatusChange(index, 'partial')
                                    }
                                  >
                                    <Pencil className='h-5 w-5' />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Пополнено частично</p>
                                </TooltipContent>
                              </Tooltip>

                              {item.status === 'partial' &&
                                !isFullyReplenished && (
                                  <div className='ml-2'>
                                    {(() => {
                                      const itemType = getKreaTouchItemType(
                                        item.name
                                      );

                                      if (isKreaTouch && itemType === 'syrup') {
                                        return (
                                          <div className='w-48'>
                                            <div className='text-sm text-gray-300 mb-1'>
                                              Выберите сиропы:
                                            </div>
                                            <div className='space-y-1'>
                                              {[
                                                { id: 'banana', name: 'Банан' },
                                                {
                                                  id: 'vanilla',
                                                  name: 'Ваниль',
                                                },
                                                {
                                                  id: 'coconut',
                                                  name: 'Кокос',
                                                },
                                                {
                                                  id: 'caramel',
                                                  name: 'Карамель',
                                                },
                                              ].map(syrup => {
                                                const isSelected =
                                                  item.selectedSyrups?.includes(
                                                    syrup.id
                                                  ) || false;

                                                return (
                                                  <div
                                                    key={syrup.id}
                                                    className='flex items-center gap-2 cursor-pointer'
                                                    onClick={() => {
                                                      const selectedSyrups =
                                                        item.selectedSyrups ||
                                                        [];
                                                      const newSelected =
                                                        isSelected
                                                          ? selectedSyrups.filter(
                                                              id =>
                                                                id !== syrup.id
                                                            )
                                                          : [
                                                              ...selectedSyrups,
                                                              syrup.id,
                                                            ];
                                                      handleSyrupChange(
                                                        index,
                                                        newSelected
                                                      );
                                                    }}
                                                  >
                                                    <div
                                                      className={cn(
                                                        'flex items-center justify-center h-5 w-5 rounded-full border-2 transition-all duration-200',
                                                        isSelected
                                                          ? 'border-green-500 bg-green-500/10'
                                                          : 'border-gray-400 hover:border-gray-300'
                                                      )}
                                                    >
                                                      {isSelected && (
                                                        <CircleCheckBig className='h-3 w-3 text-green-500 animate-scale-in' />
                                                      )}
                                                    </div>
                                                    <span
                                                      className={cn(
                                                        'text-sm transition-colors duration-200',
                                                        isSelected
                                                          ? 'text-green-300'
                                                          : 'text-gray-300'
                                                      )}
                                                    >
                                                      {syrup.name}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className='flex items-center gap-1'>
                                          <Button
                                            variant='outline'
                                            size='icon'
                                            className='h-8 w-8 rounded-full bg-gray-800 border-gray-600 hover:bg-gray-700'
                                            onClick={() => {
                                              const current =
                                                item.loadedAmount ||
                                                item.amount;
                                              handleAmountChange(
                                                index,
                                                (current - 1).toString()
                                              );
                                            }}
                                          >
                                            -
                                          </Button>
                                          <div className='w-20'>
                                            <Input
                                              type='number'
                                              value={(
                                                item.loadedAmount ?? item.amount
                                              )?.toString()}
                                              onChange={e =>
                                                handleAmountChange(
                                                  index,
                                                  e.target.value
                                                )
                                              }
                                              placeholder={item.amount?.toString()}
                                              className='bg-gray-700 border-gray-600 text-white h-9 text-center text-lg'
                                              inputMode='numeric'
                                              autoComplete='off'
                                            />
                                          </div>
                                          <Button
                                            variant='outline'
                                            size='icon'
                                            className='h-8 w-8 rounded-full bg-gray-800 border-gray-600 hover:bg-gray-700'
                                            onClick={() => {
                                              const current =
                                                item.loadedAmount ||
                                                item.amount;
                                              handleAmountChange(
                                                index,
                                                (current + 1).toString()
                                              );
                                            }}
                                          >
                                            +
                                          </Button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                            </>
                          )}
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
