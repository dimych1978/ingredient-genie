'use client';

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  useReducer,
} from 'react';
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import {
  calculateShoppingList,
  type SortType,
} from '@/lib/shopping-calculator';
import type {
  TelemetronSalesResponse,
  TelemetronSaleItem,
  LoadingOverrides,
  LoadingOverride,
  ShoppingListItem,
} from '@/types/telemetron';
import {
  getLoadingOverrides,
  saveLastSaveTime,
  saveLoadingOverrides,
  saveTelemetronPress,
  setSpecialMachineDate,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  ShoppingCart,
  Calendar,
  Download,
  X,
  Save,
  Pencil,
  CircleCheckBig,
  AlertTriangle,
  Bookmark,
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
import {
  allMachines,
  alternativeDisplayNames,
  getMachineType,
  isSpecialMachine,
} from '@/lib/data';
import { usePlanogramData } from '@/hooks/usePlanogramData';
import { ScrollNavButtons } from './scroll-nav-buttons';

interface ShoppingListItemWithStatus extends ShoppingListItem {
  status: 'none' | 'partial';
  loadedAmount?: number;
  checked?: boolean;
  checkedType?: 'big' | 'small';
  selectedSyrups?: string[];
  selectedSizes?: ('big' | 'small')[];
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

// Reducer для объединения обновлений состояния
type ShoppingListState = {
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  shoppingList: ShoppingListItemWithStatus[];
  loadedAmounts: number[];
  planogram: string[];
  coffeeProductNumbers: string[];
  salesThisPeriod: Map<string, number>;
  hasLoaded: boolean;
};

type ShoppingListAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_DELETING'; payload: boolean }
  | { type: 'SET_SHOPPING_LIST'; payload: ShoppingListItemWithStatus[] }
  | {
      type: 'SET_PLANOGRAM_DATA';
      payload: {
        planogram: string[];
        salesThisPeriod: Map<string, number>;
        coffeeProductNumbers: string[];
      };
    }
  | { type: 'SET_HAS_LOADED'; payload: boolean }
  | { type: 'UPDATE_LOADED_AMOUNTS'; payload: number[] }
  | {
      type: 'UPDATE_ITEM_STATUS';
      payload: {
        index: number;
        status: 'none' | 'partial';
        loadedAmount?: number;
      };
    }
  | {
      type: 'UPDATE_ITEM_CHECKBOX';
      payload: {
        index: number;
        checked: boolean;
        checkedType?: 'big' | 'small';
      };
    }
  | {
      type: 'UPDATE_ITEM_SYRUPS';
      payload: { index: number; selectedSyrups: string[] };
    }
  | {
      type: 'UPDATE_ITEM_SIZES';
      payload: { index: number; selectedSizes: ('big' | 'small')[] };
    };

const initialState: ShoppingListState = {
  loading: false,
  saving: false,
  deleting: false,
  shoppingList: [],
  loadedAmounts: [],
  planogram: [],
  coffeeProductNumbers: [],
  salesThisPeriod: new Map(),
  hasLoaded: false,
};

function shoppingListReducer(
  state: ShoppingListState,
  action: ShoppingListAction,
): ShoppingListState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SAVING':
      return { ...state, saving: action.payload };
    case 'SET_DELETING':
      return { ...state, deleting: action.payload };
    case 'SET_SHOPPING_LIST': {
      const loadedAmounts = action.payload.map(
        item => item.loadedAmount ?? item.amount,
      );
      return {
        ...state,
        shoppingList: action.payload,
        loadedAmounts,
        loading: false,
        hasLoaded: true,
      };
    }
    case 'SET_PLANOGRAM_DATA':
      return {
        ...state,
        planogram: action.payload.planogram,
        salesThisPeriod: action.payload.salesThisPeriod,
        coffeeProductNumbers: action.payload.coffeeProductNumbers,
      };
    case 'SET_HAS_LOADED':
      return { ...state, hasLoaded: action.payload };
    case 'UPDATE_LOADED_AMOUNTS': {
      const newShoppingList = state.shoppingList.map((item, i) => ({
        ...item,
        loadedAmount: action.payload[i] ?? item.loadedAmount,
      }));
      return {
        ...state,
        shoppingList: newShoppingList,
        loadedAmounts: action.payload,
      };
    }
    case 'UPDATE_ITEM_STATUS': {
      const newShoppingList = [...state.shoppingList];
      newShoppingList[action.payload.index] = {
        ...newShoppingList[action.payload.index],
        status: action.payload.status,
        loadedAmount: action.payload.loadedAmount,
      };
      const newLoadedAmounts = [...state.loadedAmounts];
      newLoadedAmounts[action.payload.index] =
        action.payload.loadedAmount ??
        state.loadedAmounts[action.payload.index];
      return {
        ...state,
        shoppingList: newShoppingList,
        loadedAmounts: newLoadedAmounts,
      };
    }
    case 'UPDATE_ITEM_CHECKBOX': {
      const newShoppingList = [...state.shoppingList];
      newShoppingList[action.payload.index] = {
        ...newShoppingList[action.payload.index],
        checked: action.payload.checked,
        checkedType: action.payload.checkedType,
      };
      return { ...state, shoppingList: newShoppingList };
    }
    case 'UPDATE_ITEM_SYRUPS': {
      const newShoppingList = [...state.shoppingList];
      newShoppingList[action.payload.index] = {
        ...newShoppingList[action.payload.index],
        selectedSyrups: action.payload.selectedSyrups,
      };
      return { ...state, shoppingList: newShoppingList };
    }
    case 'UPDATE_ITEM_SIZES': {
      const newShoppingList = [...state.shoppingList];
      newShoppingList[action.payload.index] = {
        ...newShoppingList[action.payload.index],
        selectedSizes: action.payload.selectedSizes,
      };
      return { ...state, shoppingList: newShoppingList };
    }
    default:
      return state;
  }
}

function normalizeForPlanogramComparison(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export const ShoppingList = ({
  machineIds: initialMachineIds,
  title = 'Shopping List',
  description,
  dateFrom,
  showControls = true,
  forceLoad = false,
  onDateChange,
  onTimestampUpdate,
  sort = 'grouped',
  markAsServiced,
}: ShoppingListProps) => {
  const [state, dispatch] = useReducer(shoppingListReducer, initialState);
  const [machineIds, setMachineIds] = useState<string[]>(initialMachineIds);
  const [isPlanogramDataReady, setPlanogramDataReady] = useState(false);

  const {
    loading,
    saving,
    shoppingList,
    loadedAmounts,
    planogram,
    coffeeProductNumbers,
    salesThisPeriod,
    hasLoaded,
  } = state;

  const machineIdsString = useMemo(() => machineIds.join(', '), [machineIds]);
  const machineIdsRef = useRef(machineIds);
  const planogramRef = useRef(planogram);
  const hasLoadedRef = useRef(hasLoaded);

  const { getSalesByProducts } = useTelemetronApi();
  const { loadPlanogramData } = usePlanogramData();
  const { toast } = useToast();

  const machine = useMemo(
    () =>
      machineIds.length === 1
        ? allMachines.find(m => m.id === machineIds[0])
        : undefined,
    [machineIds],
  );

  const planogramCache = useRef<{
    machineId: string;
    data: {
      planogram: string[];
      salesThisPeriod: Map<string, number>;
      coffeeProductNumbers: string[];
    };
    timestamp: number;
  } | null>(null);
  const CACHE_TTL = 300000; // 5 минут

  // Анализ дубликатов для визуальной подсветки
  const duplicateInfo = useMemo(() => {
    const counts = new Map<string, number>();
    const lasts = new Map<string, number>();
    shoppingList.forEach((item, idx) => {
      const name = item.name.toLowerCase().trim();
      counts.set(name, (counts.get(name) || 0) + 1);
      lasts.set(name, idx);
    });
    return { counts, lasts };
  }, [shoppingList]);

  // Стабильные функции
  const stableToast = useRef(toast).current;
  const stableGetSalesByProducts = useRef(getSalesByProducts).current;
  const stableLoadPlanogramData = useRef(loadPlanogramData).current;

  // Обновляем ref при изменении
  useEffect(() => {
    machineIdsRef.current = machineIds;
    planogramRef.current = planogram;
    hasLoadedRef.current = hasLoaded;
  }, [machineIds, planogram, hasLoaded]);

  // Загрузка планограммы - ТОЛЬКО при изменении machineIds
  useEffect(() => {
    if (machineIds.length !== 1) {
      setPlanogramDataReady(true);
      return;
    }
    let isMounted = true;
    setPlanogramDataReady(false);

    const loadPlanogram = async () => {
      const machineId = machineIds[0];
      if (
        planogramCache.current &&
        planogramCache.current.machineId === machineId &&
        Date.now() - planogramCache.current.timestamp < CACHE_TTL
      ) {
        if (isMounted) {
          dispatch({
            type: 'SET_PLANOGRAM_DATA',
            payload: planogramCache.current.data,
          });
          setPlanogramDataReady(true);
        }
        return;
      }

      try {
        const result = await stableLoadPlanogramData(machineId);

        if (isMounted) {
          planogramCache.current = {
            machineId,
            data: result,
            timestamp: Date.now(),
          };
          dispatch({ type: 'SET_PLANOGRAM_DATA', payload: result });
        }
      } catch (error) {
        console.error('Ошибка загрузки планограммы:', error);
      } finally {
        if (isMounted) {
          setPlanogramDataReady(true);
        }
      }
    };

    loadPlanogram();

    return () => {
      isMounted = false;
    };
  }, [machineIds.join('-'), stableLoadPlanogramData]);

  const loadShoppingList = useCallback(async () => {
    // ТОЛЬКО проверка на machineIds
    if (machineIdsRef.current.length === 0) {
      if (forceLoad) {
        stableToast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не указаны ID аппаратов.',
        });
      }
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const allSales: TelemetronSaleItem[] = [];
      const dateTo = new Date();
      const machineOverrides: LoadingOverrides =
        machineIdsRef.current.length === 1
          ? await getLoadingOverrides(machineIdsRef.current[0])
          : {};

      const machineData = allMachines.find(
        m => m.id === machineIdsRef.current[0],
      );

      for (const vmId of machineIdsRef.current) {
        try {
          const salesData: TelemetronSalesResponse =
            await stableGetSalesByProducts(
              vmId,
              format(
                dateFrom instanceof Date && !isNaN(dateFrom.getTime())
                  ? dateFrom
                  : new Date(0),
                'yyyy-MM-dd HH:mm:ss',
              ),
              format(dateTo, 'yyyy-MM-dd HH:mm:ss'),
            );

          if (salesData?.data) allSales.push(...salesData.data);
        } catch (e) {
          console.error(`Ошибка для аппарата ${vmId}:`, e);
        }
      }

      const calculatedList = calculateShoppingList(
        { data: allSales },
        sort,
        machineOverrides,
        machineIdsRef.current[0],
        planogramRef.current,
        machineData?.model,
        salesThisPeriod,
        coffeeProductNumbers,
      );

      // Определяем начальное состояние на основе ТЕКУЩИХ данных
      const listWithStatus: ShoppingListItemWithStatus[] = calculatedList.map(
        item => {
          const overrideKey = `${machineIdsRef.current[0]}-${item.name}`;
          const override = machineOverrides[overrideKey];

          // ВСЕГДА начинаем с крестика (status: 'none')
          const status: 'none' | 'partial' = 'none';

          // ВСЕГДА начинаем с 0
          const loadedAmount = 0;

          return {
            ...item,
            status,
            loadedAmount,
            checked: override?.checked ?? false,
            checkedType: override?.checkedType,
            selectedSyrups: override?.selectedSyrups || [],
            selectedSizes: override?.selectedSizes || [],
          };
        },
      );

      dispatch({ type: 'SET_SHOPPING_LIST', payload: listWithStatus });

      if (listWithStatus.length === 0) {
        stableToast({
          variant: 'default',
          title: 'Нет продаж',
          description: 'За выбранный период продаж не найдено.',
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки shopping list:', error);
      stableToast({
        variant: 'destructive',
        title: 'Ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось сформировать список.',
      });
    }
  }, [
    dateFrom,
    sort,
    forceLoad,
    coffeeProductNumbers,
    salesThisPeriod,
    stableGetSalesByProducts,
    stableToast,
  ]);

  // Триггер для загрузки списка.
  useEffect(() => {
    if (!forceLoad || hasLoaded || !isPlanogramDataReady) {
      return;
    }
    console.log('🚀 Данные планограммы готовы, запускаем loadShoppingList');
    loadShoppingList();
  }, [isPlanogramDataReady, forceLoad, hasLoaded, loadShoppingList]);

  // Сброс флага загрузки при смене аппарата
  useEffect(() => {
    dispatch({ type: 'SET_HAS_LOADED', payload: false });
  }, [machineIds.join('-')]);

  // Обновление machineIds
  useEffect(() => {
    setMachineIds(initialMachineIds);
  }, [initialMachineIds.join('-')]);

  // Синхронизируем loadedAmount в shoppingList с loadedAmounts
  useEffect(() => {
    const newShoppingList = shoppingList.map((item, index) => ({
      ...item,
      loadedAmount: loadedAmounts[index] ?? item.loadedAmount,
    }));

    if (JSON.stringify(newShoppingList) !== JSON.stringify(shoppingList)) {
      dispatch({ type: 'SET_SHOPPING_LIST', payload: newShoppingList });
    }
  }, [loadedAmounts]);

  const handleCheckboxChange = (index: number) => {
    dispatch({
      type: 'UPDATE_ITEM_CHECKBOX',
      payload: {
        index,
        checked: !shoppingList[index]?.checked,
      },
    });
  };

  const handleCupLidChange = (index: number, size: 'big' | 'small') => {
    const currentSizes = shoppingList[index]?.selectedSizes || [];
    const newSizes = currentSizes.includes(size)
      ? currentSizes.filter(s => s !== size)
      : [...currentSizes, size];

    dispatch({
      type: 'UPDATE_ITEM_SIZES',
      payload: { index, selectedSizes: newSizes },
    });
  };

  const handleSyrupChange = (index: number, syrupIds: string[]) => {
    dispatch({
      type: 'UPDATE_ITEM_SYRUPS',
      payload: { index, selectedSyrups: syrupIds },
    });
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

  const handleStatusChange = (index: number, status: 'none' | 'partial') => {
    // При переходе на карандаш (status: 'partial')
    // loadedAmount = item.amount (продажи + недогруз/излишек)
    // При переходе на крестик (status: 'none') loadedAmount = 0
    const loadedAmount =
      status === 'partial' ? (shoppingList[index]?.amount ?? 0) : 0;

    dispatch({
      type: 'UPDATE_ITEM_STATUS',
      payload: { index, status, loadedAmount },
    });
  };

  const handleAmountChange = (index: number, value: string) => {
    // Разрешаем отрицательные числа
    const numValue = value === '' ? 0 : parseInt(value) || 0;
    const newLoadedAmounts = [...loadedAmounts];
    newLoadedAmounts[index] = numValue;

    dispatch({ type: 'UPDATE_LOADED_AMOUNTS', payload: newLoadedAmounts });
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

    dispatch({ type: 'SET_SAVING', payload: true });
    const machineId = machineIds[0];

    try {
      const overridesToSave: LoadingOverrides = {};

      shoppingList.forEach((item, index) => {
        const key = `${machineId}-${item.name}`;

        // ВСЕГДА берем из loadedAmounts
        const actualLoadedAmount = loadedAmounts[index] ?? 0;

        const override: LoadingOverride = {
          status: item.status,
          requiredAmount: item.amount,
          loadedAmount: actualLoadedAmount,
          timestamp: new Date().toISOString(),
          checked: item.checked,
          selectedSizes: item.selectedSizes,
          selectedSyrups: item.selectedSyrups,
        };

        if (item.type === 'checkbox') {
          override.checked = item.checked ?? false;
          override.checkedType = item.checkedType;
          override.selectedSizes = item.selectedSizes || [];
        }

        if (item.type === 'select') {
          override.selectedSyrups = item.selectedSyrups || [];
        }

        if (item.type === 'auto') {
          if (item.status === 'none') {
            // Крестик: не загрузил ничего → вся сумма переносится
            override.carryOver = item.amount - actualLoadedAmount;
          } else if (item.status === 'partial') {
            // Карандаш: загрузил частично → разница
            override.carryOver = item.amount - actualLoadedAmount;
          }
        }

        overridesToSave[key] = override;
      });

      const result = await saveLoadingOverrides(overridesToSave);

      const machine = allMachines.find(m => m.id === machineId);
      if (machine && (isSpecialMachine(machine) || markAsServiced)) {
        const now = new Date();
        const newTimestamp = now.toISOString();
        await setSpecialMachineDate(machineId, newTimestamp);
        await saveTelemetronPress(machineId, newTimestamp);
        await saveLastSaveTime(machineId, newTimestamp);

        if (onTimestampUpdate) {
          onTimestampUpdate(newTimestamp);
        }
      }

      if (result.success) {
        toast({
          title: 'Сохранено',
          description: 'Состояние всех позиций сохранено.',
        });
        loadShoppingList();
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description:
          error instanceof Error ? error.message : 'Неизвестная ошибка.',
      });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  };

  const downloadList = () => {
    const periodStr = `${format(dateFrom, 'dd.MM.yyyy HH:mm')}-Сейчас`;
    const header = `${title}\nПериод: ${periodStr}\nАппараты: ${machineIdsString}\n\n`;
    const itemsText = shoppingList
      .map(
        (item, index) =>
          `${index + 1}. ${item.name}: ${item.amount} ${item.unit}`,
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

  const extractProductName = (
    planogramName: string | null,
    itemName: string,
  ): string => {
    if (!planogramName) return itemName;

    // Извлекаем чистое название без номера ячейки
    const match = planogramName.match(/^\d+[A-Za-z]?\.\s*(.+)$/);
    const cleanPlanogramName = match ? match[1] : planogramName;

    // Проверяем, есть ли альтернативное отображение
    const displayName = alternativeDisplayNames[cleanPlanogramName];

    if (displayName) {
      // Показываем альтернативу, но если в API другое название - добавляем "Фактически:"
      const normalizedClean =
        normalizeForPlanogramComparison(cleanPlanogramName);
      const normalizedItem = normalizeForPlanogramComparison(itemName);

      if (normalizedClean !== normalizedItem) {
        return `${displayName} (Фактически: ${itemName})`;
      }
      return displayName;
    }

    return cleanPlanogramName || itemName;
  };

  return (
    <>
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
                    onClick={() => {
                      dispatch({ type: 'SET_HAS_LOADED', payload: false });
                      loadShoppingList();
                    }}
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
              <div className='flex gap-3 flex-col'>
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

                    const nameLower = item.name.toLowerCase().trim();
                    const isDuplicate = (duplicateInfo.counts.get(nameLower) || 0) > 1;
                    const isLastDuplicate = duplicateInfo.lasts.get(nameLower) === index;

                    const isFullyReplenished = item.amount <= 0;
                    const hasSales = item.salesAmount && item.salesAmount > 0;
                    const deficit = item.previousDeficit || 0;
                    const hasDeficit = deficit > 0;
                    const hasSurplus = deficit < 0;

                    const infoParts: React.ReactNode[] = [];
                    if (hasSales) {
                      infoParts.push(
                        `Продажи: ${item.salesAmount} ${item.unit}`,
                      );
                    }
                    if (hasDeficit) {
                      infoParts.push(
                        <span
                          key='deficit'
                          className='font-semibold text-yellow-400'
                        >{`Недогруз: ${deficit} ${item.unit}`}</span>,
                      );
                    }
                    if (hasSurplus) {
                      infoParts.push(
                        <span
                          key='surplus'
                          className='font-semibold text-cyan-400'
                        >{`Излишек: ${Math.abs(deficit)} ${item.unit}`}</span>,
                      );
                    }

                    const isKreaMachine = machine?.model
                      ?.toLowerCase()
                      .includes('krea');
                    const isSpecialKreaItem =
                      isKreaMachine &&
                      (item.name === 'стаканы' || item.name === 'крышки');
                    const isCheckboxItem =
                      item.type === 'checkbox' && !isSpecialKreaItem;
                    const isSyrupItem = item.type === 'select';

                    return (
                      <div
                        key={index}
                        className={cn(
                          'flex flex-col sm:flex-row sm:justify-between sm:items-start p-3 border rounded-lg gap-3 transition-all duration-200',
                          isFullyReplenished
                            ? 'bg-green-900/20 border-green-600 text-green-300'
                            : item.status === 'none'
                              ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300'
                              : 'bg-blue-900/20 border-blue-600 text-blue-300',
                          // Подсветка дубликатов
                          isDuplicate && !isLastDuplicate &&  'border-2 border-dashed border-blue-400/70 shadow-[inset_0_0_8px_rgba(96,165,250,0.15)]',
                          isDuplicate && isLastDuplicate && 'border-blue-400 border-2 ring-1 ring-blue-400/30 shadow-[0_0_8px_rgba(96,165,250,0.2)]'
                        )}
                      >
                        {/* Левый блок - информация о товаре */}
                        <div className='flex-1 min-w-0 space-y-1'>
                          <div className='font-medium capitalize'>
                            <div className='flex items-center gap-2 flex-wrap'>
                              {extractProductName(
                                item.planogramName,
                                item.name,
                              )}
                              {isDuplicate && isLastDuplicate && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Bookmark className='h-4 w-4 text-blue-400 fill-blue-400/20' />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Это последняя ячейка данного товара.</p>
                                    <p>Используйте её для ввода общего недогруза.</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {item.planogramName &&
                                extractProductName(
                                  item.planogramName,
                                  item.name,
                                ) !== item.name && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertTriangle className='h-4 w-4 text-yellow-500 flex-shrink-0' />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>В аппарате: {item.name}</p>
                                      <p>
                                        В планограмме:{' '}
                                        {extractProductName(
                                          item.planogramName,
                                          item.name,
                                        )}
                                      </p>
                                      {item.planogramName.match(
                                        /^\d+[A-Za-z]?\./,
                                      ) && (
                                        <p className='text-xs text-gray-500 mt-1'>
                                          Ячейка:{' '}
                                          {
                                            item.planogramName.match(
                                              /^(\d+[A-Za-z]?)\./,
                                            )?.[1]
                                          }
                                        </p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                            </div>
                            {item.planogramName &&
                              extractProductName(
                                item.planogramName,
                                item.name,
                              ) !== item.name && (
                                <div className='text-sm text-gray-400 mt-1 break-words'>
                                  Фактически: {item.name}
                                </div>
                              )}
                          </div>

                          {isSpecialKreaItem ||
                          isSyrupItem ||
                          isCheckboxItem ? (
                            <div className='text-sm text-gray-400 break-words'>
                              {`Продажи: ${item.salesAmount || 0} ${item.unit}`}
                            </div>
                          ) : (
                            <>
                              <div className='text-sm text-gray-400 break-words'>
                                {infoParts.length > 0
                                  ? infoParts.map((part, i) => (
                                      <React.Fragment key={i}>
                                        {part}
                                        {i < infoParts.length - 1 ? ' + ' : ''}
                                      </React.Fragment>
                                    ))
                                  : null}
                              </div>
                              <div
                                className={cn(
                                  'text-base font-bold break-words',
                                  isFullyReplenished
                                    ? 'text-green-400'
                                    : 'text-white',
                                )}
                              >
                                {isFullyReplenished
                                  ? 'Пополнено'
                                  : `Нужно: ${item.amount.toLocaleString(
                                      'ru-RU',
                                    )} ${item.unit}`}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Правый блок - кнопки управления */}
                        <div className='flex items-center gap-2 self-end sm:self-center flex-wrap justify-end'>
                          {isSyrupItem ? (
                            <div className='w-full sm:w-48'>
                              <div className='text-sm text-gray-300 mb-1'>
                                Выберите сиропы:
                              </div>
                              <div className='space-y-1'>
                                {item.syrupOptions?.map(syrup => {
                                  const isSelected =
                                    item.selectedSyrups?.includes(syrup.id) ||
                                    false;
                                  return (
                                    <div
                                      key={syrup.id}
                                      className='flex items-center justify-between cursor-pointer'
                                      onClick={() => {
                                        const selectedSyrups =
                                          item.selectedSyrups || [];
                                        const newSelected = isSelected
                                          ? selectedSyrups.filter(
                                              id => id !== syrup.id,
                                            )
                                          : [...selectedSyrups, syrup.id];
                                        handleSyrupChange(index, newSelected);
                                      }}
                                    >
                                      <div className='flex items-center gap-2 min-w-0'>
                                        <div
                                          className={cn(
                                            'flex items-center justify-center h-5 w-5 rounded-full border-2 flex-shrink-0',
                                            isSelected
                                              ? 'border-green-500 bg-green-500/10'
                                              : 'border-gray-400 hover:border-gray-300',
                                          )}
                                        >
                                          {isSelected && (
                                            <CircleCheckBig className='h-3 w-3 text-green-500' />
                                          )}
                                        </div>
                                        <span
                                          className={cn(
                                            'text-sm truncate',
                                            isSelected
                                              ? 'text-green-300'
                                              : 'text-gray-300',
                                          )}
                                        >
                                          {syrup.name}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-sm whitespace-nowrap flex-shrink-0 ml-2 ${
                                          isSelected
                                            ? 'text-green-500'
                                            : 'text-yellow-200'
                                        }`}
                                      >
                                        {isSelected ? 'Не надо' : 'Нужно'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : isSpecialKreaItem ? (
                            <div className='flex flex-col gap-2 w-full sm:w-40'>
                              {(['big', 'small'] as const).map(size => {
                                const isSelected =
                                  item.selectedSizes?.includes(size);
                                return (
                                  <div
                                    key={size}
                                    className='flex items-center justify-between cursor-pointer'
                                    onClick={() =>
                                      handleCupLidChange(index, size)
                                    }
                                  >
                                    <div className='flex items-center gap-2 min-w-0'>
                                      <div
                                        className={cn(
                                          'flex items-center justify-center h-5 w-5 rounded-full border-2 flex-shrink-0',
                                          isSelected
                                            ? 'border-green-500 bg-green-500/10'
                                            : 'border-gray-400 hover:border-gray-300',
                                        )}
                                      >
                                        {isSelected && (
                                          <CircleCheckBig className='h-3 w-3 text-green-500' />
                                        )}
                                      </div>
                                      <span
                                        className={cn(
                                          'text-sm truncate',
                                          isSelected
                                            ? 'text-green-300'
                                            : 'text-gray-300',
                                          )}
                                        >
                                          {size === 'big' ? 'Большие' : 'Малые'}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-sm whitespace-nowrap flex-shrink-0 ml-2 ${isSelected ? 'text-green-500' : 'text-yellow-200'}`}
                                      >
                                        {isSelected ? 'Не надо' : 'Нужно'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : isCheckboxItem ? (
                              <div className='flex items-center gap-2'>
                                <button
                                  onClick={() => handleCheckboxChange(index)}
                                  className='flex items-center justify-center h-6 w-6 rounded-full border-2 border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 flex-shrink-0'
                                >
                                  {item.checked && (
                                    <CircleCheckBig className='h-4 w-4 text-green-500' />
                                  )}
                                </button>
                                <span
                                  className={`text-sm whitespace-nowrap ${
                                    item.checked
                                      ? 'text-green-500'
                                      : 'text-yellow-200'
                                  }`}
                                >
                                  {item.checked ? 'Не надо' : 'Нужно'}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className='flex items-center gap-2 flex-wrap'>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant='ghost'
                                        size='icon'
                                        className={cn(
                                          'rounded-full flex-shrink-0',
                                          item.status === 'none' &&
                                            'bg-red-500/20 text-red-400 hover:bg-red-500/30',
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
  
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant='ghost'
                                        size='icon'
                                        className={cn(
                                          'rounded-full flex-shrink-0',
                                          item.status === 'partial' &&
                                            'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
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
  
                                  {item.status === 'partial' && (
                                    <div className='ml-2'>
                                      <div className='flex items-center gap-1 flex-wrap'>
                                        <Button
                                          variant='outline'
                                          size='icon'
                                          className='h-8 w-8 rounded-full bg-gray-800 border-gray-600 hover:bg-gray-700 flex-shrink-0'
                                          onClick={() => {
                                            const current =
                                              loadedAmounts[index] ?? 0;
                                            handleAmountChange(
                                              index,
                                              (current - 1).toString(),
                                            );
                                          }}
                                        >
                                          -
                                        </Button>
                                        <div className='w-20 min-w-20'>
                                          <Input
                                            type='number'
                                            value={
                                              loadedAmounts[index]?.toString() ??
                                              '0'
                                            }
                                            onChange={e =>
                                              handleAmountChange(
                                                index,
                                                e.target.value,
                                              )
                                            }
                                            placeholder={item.amount?.toString()}
                                            className='bg-gray-700 border-gray-600 text-white h-9 text-center text-lg w-full'
                                            inputMode='numeric'
                                            autoComplete='off'
                                          />
                                        </div>
                                        <Button
                                          variant='outline'
                                          size='icon'
                                          className='h-8 w-8 rounded-full bg-gray-800 border-gray-600 hover:bg-gray-700 flex-shrink-0'
                                          onClick={() => {
                                            const current =
                                              loadedAmounts[index] ?? 0;
                                            handleAmountChange(
                                              index,
                                              (current + 1).toString(),
                                            );
                                          }}
                                        >
                                          +
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </TooltipProvider>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <ScrollNavButtons />
      </>
    );
  };
