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
import {
  Loader2,
  Eye,
  Search,
  X,
  Info,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import type { TelemetronSaleItem } from '@/types/telemetron';
import {
  allMachines,
  getIngredientConfig,
  GroupedShoppingListsProps,
  machineIngredients,
  PRODUCT_GROUPS,
} from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SoundButton } from './ui/sound-button';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { useScheduleState } from './context/ScheduleStateContext';

type CombinedListItem = {
  name: string;
  amount: number;
  unit: string;
  isCoffeeIngredient: boolean;
  breakdown: Record<string, { name: string; amount: number }>;
  salesBreakdown?: Record<string, { name: string; amount: number }>;
  expiryStatus?: 'ok' | 'critical' | 'empty';
  checkedMachines?: Record<string, boolean>;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Кофейные ингредиенты — для них срок не показываем
const ALL_COFFEE_INGREDIENTS = new Set(
  Object.values(machineIngredients).flatMap(modelIngs =>
    modelIngs.map(ing => normalize(ing.name)),
  ),
);

// Добавляем динамические имена (стаканы большие/малые, крышки, сиропы)
Object.values(machineIngredients).forEach(modelIngredients => {
  modelIngredients.forEach(ing => {
    if (ing.size) {
      const prefix = ing.name.includes('крышк') ? 'крышки' : 'стаканы';
      ALL_COFFEE_INGREDIENTS.add(
        normalize(`${prefix} ${ing.size === 'big' ? 'большие' : 'малые'}`),
      );
    } else if (ing.hasSizes) {
      const prefix = ing.name.includes('крышк') ? 'крышки' : 'стаканы';
      ALL_COFFEE_INGREDIENTS.add(normalize(`${prefix} большие`));
      ALL_COFFEE_INGREDIENTS.add(normalize(`${prefix} малые`));
    } else if (ing.syrupOptions) {
      ing.syrupOptions.forEach(syrup => {
        ALL_COFFEE_INGREDIENTS.add(normalize(`сироп ${syrup.name}`));
      });
    }
  });
});

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

  const [activeHints, setActiveHints] = useState<{
    activeHint: string | null;
    activeGroup: string | null;
    activeDetail: string | null;
  }>({ activeHint: null, activeGroup: null, activeDetail: null });

  const { activeHint, activeGroup, activeDetail } = activeHints;

  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('search_history') || '[]');
    } catch {
      return [];
    }
  });

  const [showHistory, setShowHistory] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getMachineOverview, getSalesByProducts } = useTelemetronApi();

  const { expirationDates } = useScheduleState();

  const validMachineIds = useMemo(() => {
    const uniqueIds = Array.from(new Set(machineIds));
    return uniqueIds.filter(id => allMachines.some(m => m.id === id));
  }, [machineIds]);

  const machineIdsToProcess = useMemo(() => {
    return validMachineIds.filter(id => !aaMachineIds.has(id));
  }, [validMachineIds, aaMachineIds]);

  const machineIdsToProcessCount = machineIdsToProcess.length;

  const handleHintToggle = (name: string) => {
    setActiveHints(prev => ({ ...prev, activeHint: name }));
    const item = combinedList.find(i => i.name === name);
    // Для товаров с критическим сроком не закрываем попап автоматически
    if (item?.expiryStatus !== 'critical') {
      setTimeout(
        () => setActiveHints(prev => ({ ...prev, activeHint: null })),
        1500,
      );
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim() && !history.includes(value)) {
        const next = [value, ...history].slice(0, 10);
        setHistory(next);
        localStorage.setItem('search_history', JSON.stringify(next));
      }
    }, 500);
  };

  const getExpiryStatus = (itemName: string) => {
    // Кофейные ингредиенты без срока
    if (ALL_COFFEE_INGREDIENTS.has(normalize(itemName))) return 'ok';

    const dateStr = expirationDates?.[itemName];
    if (!dateStr) return 'empty';

    const expiryDate = parseISO(dateStr);
    if (!isValid(expiryDate)) return 'empty';

    const daysLeft = differenceInDays(expiryDate, new Date());
    if (daysLeft <= 14) return 'critical';
    return 'ok';
  };

  const getCupsName = (
    apiName: string,
    machineModel?: string,
    ingredientConfig?: ReturnType<typeof getIngredientConfig>,
  ) => {
    const config =
      ingredientConfig || getIngredientConfig(apiName, machineModel);
    if (!config) return apiName;

    if (config.size) {
      const prefix = config.name.includes('крышк') ? 'крышки' : 'стаканы';
      return `${prefix} ${config.size === 'big' ? 'большие' : 'малые'}`;
    }

    return config.name;
  };

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
          isCoffeeIngredient: boolean;
          breakdown: Record<string, { name: string; amount: number }>;
          salesBreakdown?: Record<string, { name: string; amount: number }>;
        }
      >();
      const productMap = new Map<
        string,
        {
          amount: number;
          unit: 'шт';
          breakdown: Record<string, { name: string; amount: number }>;
          isCoffeeIngredient: boolean;
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
            const displayName = getCupsName(
              apiIngredient.name,
              machine.model,
              config,
            );

            if (config) {
              if (config.name === 'крышки' || config.name.includes('крышк'))
                return;

              if (
                (config.name === 'размешиватели' ||
                  config.name.includes('размешивател')) &&
                config.type === 'checkbox'
              )
                return;

              if (
                (config.name === 'сахар' || config.name === 'сироп') &&
                machine?.model &&
                (machine.model.toLowerCase().includes('krea') ||
                  machine.model.toLowerCase().includes('jetinno'))
              ) {
                return;
              }

              const current = coffeeIngredientsMap.get(displayName) || {
                amount: 0,
                unit: config.unit,
                breakdown: {} as Record<
                  string,
                  { name: string; amount: number }
                >,
                isCoffeeIngredient: true,
              };

              const amountToAdd = apiIngredient.volume * sale.number;
              current.amount += amountToAdd;

              const machineBreakdown = current.breakdown[sale.machineId] || {
                name: machine.name,
                amount: 0,
              };

              machineBreakdown.amount += amountToAdd;
              current.breakdown[sale.machineId] = machineBreakdown;
              coffeeIngredientsMap.set(displayName, current);
            }
          });
        } else {
          const name = sale.planogram.name;
          const current = productMap.get(name) || {
            amount: 0,
            unit: 'шт',
            breakdown: {} as Record<string, { name: string; amount: number }>,
            isCoffeeIngredient: false,
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

        if (!machineIdsToProcess.includes(machineIdFromFile)) continue;

        const name = key.substring(machineIdFromFile.length + 1);
        const machine = allMachines.find(m => m.id === machineIdFromFile);

        if (!machine) continue;

        if (
          (name === 'сахар' || name === 'сироп') &&
          machine?.model &&
          (machine.model.toLowerCase().includes('krea') ||
            machine.model.toLowerCase().includes('jetinno'))
        ) {
          continue;
        }

        // 🔥 СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ СТАКАНОВ
        if (name.includes('стаканы')) {
          const ingredientConfig = getIngredientConfig(name, machine?.model);
          const displayName = getCupsName(
            name,
            machine?.model,
            ingredientConfig,
          );
          const selectedSizes = override.selectedSizes || [];
          const allSizes = ['big', 'small'] as const;
          const sizeLabels = { big: 'большие', small: 'малые' };

          if (ingredientConfig?.hasSizes) {
            allSizes.forEach(size => {
              if (!selectedSizes.includes(size)) {
                const sizeName = `стаканы ${sizeLabels[size]}`;
                const current = coffeeIngredientsMap.get(sizeName) || {
                  amount: 0,
                  unit: 'уп',
                  breakdown: {} as Record<
                    string,
                    { name: string; amount: number }
                  >,
                  isCoffeeIngredient: true,
                };
                current.amount += 1;
                const machineBreakdown = current.breakdown[
                  machineIdFromFile
                ] || {
                  name: machine.name,
                  amount: 0,
                };
                machineBreakdown.amount += 1;
                current.breakdown[machineIdFromFile] = machineBreakdown;
                coffeeIngredientsMap.set(sizeName, current);
              }
            });
            continue;
          }

          if (ingredientConfig?.size) {
            const sizeName = `стаканы ${ingredientConfig.size === 'big' ? 'большие' : 'малые'}`;

            if (ingredientConfig?.type === 'checkbox') {
              const isChecked = override.checked === true;
              if (!isChecked) {
                const current = coffeeIngredientsMap.get(sizeName) || {
                  amount: 0,
                  unit: 'уп',
                  breakdown: {} as Record<
                    string,
                    { name: string; amount: number }
                  >,
                  isCoffeeIngredient: true,
                };
                current.amount += 1;

                const machineBreakdown = current.breakdown[
                  machineIdFromFile
                ] || {
                  name: machine.name,
                  amount: 0,
                };
                machineBreakdown.amount += 1;

                coffeeIngredientsMap.set(sizeName, current);
              }
              continue;
            }

            const overRide = override.carryOver;

            const current = coffeeIngredientsMap.get(sizeName) || {
              amount: 0,
              unit: 'шт',
              breakdown: {} as Record<string, { name: string; amount: number }>,
              isCoffeeIngredient: true,
            };
            const machineBreakdown = current.breakdown[machineIdFromFile] || {
              name: machine.name,
              amount: 0,
            };
            if (overRide) {
              const totalShots = machineBreakdown.amount + overRide;

              current.breakdown[machineIdFromFile] = {
                name: machine.name,
                amount: totalShots,
              };

              coffeeIngredientsMap.set(sizeName, current);
              current.amount = Object.values(current.breakdown).reduce(
                (sum, b) => sum + b.amount,
                0,
              );
              console.log('machineName', machine.name, current);
            }
            continue;
          }

          const current = coffeeIngredientsMap.get(displayName) || {
            amount: 0,
            unit: ingredientConfig?.unit as string,
            breakdown: {} as Record<string, { name: string; amount: number }>,
            isCoffeeIngredient: true,
          };

          const machineBreakdown = current.breakdown[machineIdFromFile]?.amount;
          const carryOver = override.carryOver || 0;
          const totalShots = machineBreakdown + carryOver;
          current.breakdown[machineIdFromFile] = {
            name: machine.name,
            amount: totalShots,
          };

          current.amount = Object.values(current.breakdown).reduce(
            (sum, b) => sum + b.amount,
            0,
          );
          coffeeIngredientsMap.set(displayName, current);
          continue;
        }

        // 🔥 СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ КРЫШЕК
        if (name === 'крышки') {
          const ingredientConfig = getIngredientConfig(name, machine?.model);

          // Если есть hasSizes — Krea, разбиваем на большие/малые
          if (ingredientConfig?.hasSizes) {
            const selectedSizes = override.selectedSizes || [];
            const allSizes = ['big', 'small'] as const;
            const sizeLabels = { big: 'большие', small: 'малые' };

            allSizes.forEach(size => {
              if (!selectedSizes.includes(size)) {
                const sizeName = `крышки ${sizeLabels[size]}`;
                const current = coffeeIngredientsMap.get(sizeName) || {
                  amount: 0,
                  unit: 'уп',
                  breakdown: {} as Record<
                    string,
                    { name: string; amount: number }
                  >,
                  isCoffeeIngredient: true,
                };
                current.amount += 1;
                const machineBreakdown = current.breakdown[
                  machineIdFromFile
                ] || {
                  name: machine.name,
                  amount: 0,
                };
                machineBreakdown.amount += 1;
                current.breakdown[machineIdFromFile] = machineBreakdown;
                coffeeIngredientsMap.set(sizeName, current);
              }
            });
            continue;
          }

          // Если есть size — создаём строку с нужным размером
          if (ingredientConfig?.size) {
            const sizeName = `крышки ${ingredientConfig.size === 'big' ? 'большие' : 'малые'}`;
            const isChecked = override.checked === true;
            if (!isChecked) {
              const current = coffeeIngredientsMap.get(sizeName) || {
                amount: 0,
                unit: 'уп',
                breakdown: {} as Record<
                  string,
                  { name: string; amount: number }
                >,
                isCoffeeIngredient: true,
              };
              current.amount += 1;
              const machineBreakdown = current.breakdown[machineIdFromFile] || {
                name: machine.name,
                amount: 0,
              };
              machineBreakdown.amount += 1;
              current.unit = 'уп';
              current.breakdown[machineIdFromFile] = machineBreakdown;
              coffeeIngredientsMap.set(sizeName, current);
            }
            continue;
          }
        }

        // 🔥 СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ РАЗМЕШИВАТЕЛЕЙ
        if (name.includes('размешивател')) {
          const ingredientConfig = getIngredientConfig(name, machine?.model);

          if (ingredientConfig?.type === 'checkbox') {
            const isChecked = override.checked === true;

            if (!isChecked) {
              const displayName = ingredientConfig.name;
              const current = coffeeIngredientsMap.get(displayName) || {
                amount: 0,
                unit: 'уп',
                breakdown: {} as Record<
                  string,
                  { name: string; amount: number }
                >,
                isCoffeeIngredient: true,
              };
              current.amount += 1;
              current.unit = 'уп';

              const machineBreakdown = current.breakdown[machineIdFromFile] || {
                name: machine.name,
                amount: 0,
              };
              machineBreakdown.amount += 1;
              current.breakdown[machineIdFromFile] = machineBreakdown;

              coffeeIngredientsMap.set(displayName, current);
            }
            continue;
          }

          // Если не чекбокс — обычная обработка
          if (ingredientConfig) {
            const current = coffeeIngredientsMap.get(ingredientConfig.name) || {
              amount: 0,
              unit: ingredientConfig?.unit as string,
              breakdown: {} as Record<string, { name: string; amount: number }>,
              isCoffeeIngredient: true,
            };

            const carryOver = override.carryOver || 0;
            current.amount += carryOver;
            const machineBreakdown = current.breakdown[machineIdFromFile] || {
              name: machine.name,
              amount: 0,
            };
            machineBreakdown.amount += carryOver;
            current.breakdown[machineIdFromFile] = machineBreakdown;
            coffeeIngredientsMap.set(ingredientConfig.name, current);
            continue;
          }
        }

        // 🔥 СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ СИРОПОВ
        if (name === 'сироп') {
          const selectedSyrups = override.selectedSyrups || [];
          // Все возможные сиропы — берём из конфига или определяем здесь
          const ingredientConfig = getIngredientConfig(name, machine?.model);
          const allSyrups = ingredientConfig?.syrupOptions || [];

          allSyrups.forEach(syrup => {
            if (!selectedSyrups.includes(syrup.id)) {
              const syrupName = `сироп ${syrup.name}`;
              const current = coffeeIngredientsMap.get(syrupName) || {
                amount: 0,
                unit: 'шт',
                breakdown: {} as Record<
                  string,
                  { name: string; amount: number }
                >,
                isCoffeeIngredient: true,
              };
              current.amount += 1;
              const machineBreakdown = current.breakdown[machineIdFromFile] || {
                name: machine.name,
                amount: 0,
              };
              machineBreakdown.amount += 1;
              current.breakdown[machineIdFromFile] = machineBreakdown;
              coffeeIngredientsMap.set(syrupName, current);
            }
          });
          continue;
        }

        // ОБЫЧНАЯ ОБРАБОТКА ДЛЯ ОСТАЛЬНЫХ ТОВАРОВ (carryOver)
        let carryOver = override.carryOver || 0;
        if (carryOver < 0) carryOver = 0;

        const ingredientConfig = getIngredientConfig(name, machine?.model);

        // 🔥 Если есть packSize — делим carryOver на packSize и округляем вверх
        let adjustedCarryOver = carryOver;
        if (ingredientConfig?.packSize && ingredientConfig.packSize > 0) {
          const oldCarryOver = carryOver;
          adjustedCarryOver = Math.ceil(carryOver / ingredientConfig.packSize);
        }

        if (ingredientConfig) {
          const current = coffeeIngredientsMap.get(ingredientConfig.name) || {
            amount: 0,
            unit: ingredientConfig.unit,
            breakdown: {} as Record<string, { name: string; amount: number }>,
            isCoffeeIngredient: true,
          };
          current.amount += adjustedCarryOver;
          const machineBreakdown = current.breakdown[machineIdFromFile] || {
            name: machine.name,
            amount: 0,
          };
          machineBreakdown.amount += adjustedCarryOver;
          current.breakdown[machineIdFromFile] = machineBreakdown;
          coffeeIngredientsMap.set(ingredientConfig.name, current);
        } else {
          const current = productMap.get(name) || {
            amount: 0,
            unit: 'шт',
            breakdown: {},
            isCoffeeIngredient: false,
          };
          current.amount += adjustedCarryOver;
          const machineBreakdown = current.breakdown[machineIdFromFile] || {
            name: machine.name,
            amount: 0,
          };
          machineBreakdown.amount += adjustedCarryOver;
          current.breakdown[machineIdFromFile] = machineBreakdown;
          productMap.set(name, current);
        }
      }

      for (const [name, value] of coffeeIngredientsMap.entries()) {
        if (value.unit === 'уп') continue;

        const salesBreakdown = { ...value.breakdown };

        const newBreakdown: typeof value.breakdown = {};
        let totalPacks = 0;
        let unitChanged = false;

        for (const [mId, details] of Object.entries(value.breakdown)) {
          const machine = allMachines.find(m => m.id === mId);

          let config = getIngredientConfig(name, machine?.model);
          if (!config && machine?.model) {
            const baseName = name.split(' ')[0];
            config = getIngredientConfig(baseName, machine?.model);
          }

          if (config?.packSize) {
            const packs = Math.floor(details.amount / config.packSize);
            if (packs > 0) {
              newBreakdown[mId] = {
                name: details.name,
                amount: packs,
              };
              totalPacks += packs;
              unitChanged = true;
            }
          } else {
            newBreakdown[mId] = details;
            totalPacks += details.amount;
          }
        }

        if (totalPacks > 0) {
          value.amount = totalPacks;
          if (unitChanged) value.unit = 'уп';
          value.breakdown = newBreakdown;
          value.salesBreakdown = salesBreakdown;
          coffeeIngredientsMap.set(name, value);
        } else {
          coffeeIngredientsMap.delete(name);
        }
      }

      coffeeIngredientsMap.delete('крышки');
      coffeeIngredientsMap.delete('стаканы');

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
            salesBreakdown: value.salesBreakdown,
          });
        }
      });

      productMap.forEach((value, name) => {
        const totalAmount = Math.ceil(Math.max(0, value.amount));
        const checkedMachinesKey = `checked_machines_${name}`;
        const checkedMachinesDateKey = `checked_machines_date_${name}`;

        let checkedMachines: Record<string, boolean> = {};

        try {
          const savedDate = localStorage.getItem(checkedMachinesDateKey);
          const currentExpiryDate = expirationDates?.[name];

          // Если срок изменился — сбрасываем чекбоксы
          if (savedDate !== currentExpiryDate) {
            localStorage.removeItem(checkedMachinesKey);
            if (currentExpiryDate) {
              localStorage.setItem(checkedMachinesDateKey, currentExpiryDate);
            }
          } else {
            const saved = localStorage.getItem(checkedMachinesKey);
            if (saved) checkedMachines = JSON.parse(saved);
          }
        } catch {}

        if (totalAmount > 0) {
          finalList.push({
            name: name,
            amount: totalAmount,
            unit: value.unit,
            isCoffeeIngredient: value.isCoffeeIngredient ?? false,
            breakdown: value.breakdown,
            expiryStatus: getExpiryStatus(name),
            checkedMachines,
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
  }, [combinedList, searchQuery, stockOnHand]);

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
    setShowHistory(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className='space-y-6'>
      <Card className='bg-muted/20'>
        <CardHeader className='px-3 sm:px-6'>
          <CardTitle>Формирование общего заказа</CardTitle>
          <CardDescription>
            {validMachineIds.length > 0
              ? `Нажмите, чтобы создать сводный список по ${machineIdsToProcessCount} аппаратам.`
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
          <CardHeader className='sticky top-0 z-20 bg-background/95 backdrop-blur border-b pb-4 px-3 sm:px-6'>
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
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => !searchQuery && setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  className='pl-9 pr-10 h-9'
                />

                {/* История выпадает вверх */}
                {showHistory && !searchQuery && history.length > 0 && (
                  <div className='absolute top-full left-0 right-0 bg-background border rounded-md shadow-lg mb-1 z-50 max-h-48 overflow-y-auto'>
                    {history.slice(0, 10).map((item, i) => (
                      <div
                        key={i}
                        className='flex items-center justify-between hover:bg-muted transition-colors'
                      >
                        <button
                          className='w-full text-left px-3 py-2 text-xs'
                          onMouseDown={e => {
                            e.preventDefault();
                            setSearchQuery(item);
                            setShowHistory(false);
                            inputRef.current?.focus();
                          }}
                        >
                          {item}
                        </button>
                        <button
                          className='px-2 py-2 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0'
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHistory(prev => {
                              const next = prev.filter(h => h !== item);
                              localStorage.setItem(
                                'search_history',
                                JSON.stringify(next),
                              );
                              return next;
                            });
                          }}
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
            <Table className='table-fixed w-full'>
              <TableHeader>
                <TableRow>
                  <TableHead className='px-1 py-2 md:px-2 w-[70%]'>
                    Название
                  </TableHead>
                  <TableHead className='px-1 py-2 md:px-2 text-right w-[20%]'>
                    Кол-во
                  </TableHead>
                  <TableHead className='px-1 py-2 md:px-2 w-[10%] text-right'>
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
                      className={cn(
                        isGroup && 'bg-primary/5',
                        item.expiryStatus === 'critical' && 'bg-[#E90F44]/60',
                      )}
                    >
                      <TableCell className='px-1 py-2 md:px-2 font-medium overflow-hidden'>
                        <div className='flex items-center gap-1 sm:gap-2 w-full'>
                          <div className='flex items-center gap-1 flex-shrink-0'>
                            {isGroup ? (
                              <Popover
                                open={activeGroup === item.name}
                                onOpenChange={open =>
                                  setActiveHints(prev => ({
                                    ...prev,
                                    activeGroup: open ? item.name : null,
                                  }))
                                }
                              >
                                <PopoverTrigger asChild>
                                  <div className='relative cursor-pointer'>
                                    <Input
                                      value={
                                        getGroupTotal(item.name) === '0'
                                          ? ''
                                          : getGroupTotal(item.name)
                                      }
                                      readOnly
                                      className='h-8 w-10 sm:w-12 text-center p-1 font-bold border-primary/30 bg-primary/10'
                                    />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className='w-80'>
                                  <div className='space-y-3'>
                                    <h4 className='font-medium text-sm leading-none border-b pb-2 flex justify-between items-center gap-2'>
                                      {item.name}
                                      <Info className='h-3 w-3 text-primary' />{' '}
                                      <Button
                                        variant='ghost'
                                        size='icon'
                                        className='h-6 w-6 rounded-full'
                                        onClick={e => {
                                          e.stopPropagation();
                                          setActiveHints(prev => ({
                                            ...prev,
                                            activeGroup: null,
                                          }));
                                        }}
                                      >
                                        <X className='h-3 w-3 text-[#F44336]' />
                                      </Button>
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
                                              <SoundButton
                                                variant='outline'
                                                size='icon'
                                                className='h-7 w-7 rounded-full'
                                                onClick={() =>
                                                  handleStep(constituent, -1)
                                                }
                                              >
                                                <Minus className='h-3 w-3' />
                                              </SoundButton>
                                              <Input
                                                type='number'
                                                value={
                                                  stockOnHand[constituent] ===
                                                  '0'
                                                    ? ''
                                                    : stockOnHand[
                                                        constituent
                                                      ] || ''
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
                                              <SoundButton
                                                variant='outline'
                                                size='icon'
                                                className='h-7 w-7 rounded-full'
                                                onClick={() =>
                                                  handleStep(constituent, 1)
                                                }
                                              >
                                                <Plus className='h-3 w-3' />
                                              </SoundButton>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>{' '}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <>
                                <SoundButton
                                  variant='ghost'
                                  size='icon'
                                  className='h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground'
                                  soundType='decrement'
                                  onClick={() => handleStep(item.name, -1)}
                                >
                                  <Minus className='h-3 w-3' />
                                </SoundButton>
                                <Input
                                  type='number'
                                  value={
                                    stockOnHand[item.name] === '0'
                                      ? ''
                                      : stockOnHand[item.name] || ''
                                  }
                                  onChange={e =>
                                    onStockChange(item.name, e.target.value)
                                  }
                                  className='h-8 w-10 sm:w-12 text-center p-1'
                                  placeholder='0'
                                />
                                <SoundButton
                                  variant='ghost'
                                  size='icon'
                                  className='h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground'
                                  soundType='increment'
                                  onClick={() => handleStep(item.name, 1)}
                                >
                                  <Plus className='h-3 w-3' />
                                </SoundButton>
                              </>
                            )}
                          </div>{' '}
                          <div className='flex flex-col min-w-0 flex-1'>
                            <Popover
                              open={activeHint === item.name}
                              onOpenChange={open => {
                                if (!open)
                                  setActiveHints(prev => ({
                                    ...prev,
                                    activeHint: null,
                                  }));
                              }}
                            >
                              <PopoverTrigger asChild>
                                <span
                                  className={cn(
                                    'min-w-0 break-words line-clamp-2 text-xs sm:text-sm leading-tight cursor-pointer',
                                    isGroup && 'font-bold text-primary',
                                  )}
                                  onClick={() => handleHintToggle(item.name)}
                                >
                                  {item.name}
                                </span>
                              </PopoverTrigger>
                              <PopoverContent className='w-80 p-3'>
                                <div className='space-y-2'>
                                  <div className='flex items-center justify-between border-b pb-2'>
                                    <h4 className='font-medium text-sm leading-none border-b pb-2'>
                                      Проверка срока: {item.name}
                                    </h4>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      className='h-6 w-6 rounded-full'
                                      onClick={e => {
                                        e.stopPropagation();
                                        setActiveHints(prev => ({
                                          ...prev,
                                          activeHint: null,
                                        }));
                                      }}
                                    >
                                      <X className='h-3 w-3 text-[#F44336]' />
                                    </Button>
                                  </div>
                                  <div className='grid gap-1'>
                                    {Object.entries(item.breakdown).map(
                                      ([machineId, details]) => (
                                        <div
                                          key={machineId}
                                          className='flex items-center gap-2 p-1 rounded hover:bg-muted/20 cursor-pointer'
                                          onClick={() => {
                                            const key = `checked_machines_${item.name}`;
                                            const updated = {
                                              ...item.checkedMachines,
                                              [machineId]:
                                                !item.checkedMachines?.[
                                                  machineId
                                                ],
                                            };
                                            localStorage.setItem(
                                              key,
                                              JSON.stringify(updated),
                                            );

                                            setCombinedList(prev =>
                                              prev.map(i =>
                                                i.name === item.name
                                                  ? {
                                                      ...i,
                                                      checkedMachines: updated,
                                                    }
                                                  : i,
                                              ),
                                            );
                                          }}
                                        >
                                          <div
                                            className={cn(
                                              'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                                              item.checkedMachines?.[machineId]
                                                ? 'border-green-500 bg-green-500/20'
                                                : 'border-red-500 bg-red-500/10',
                                            )}
                                          >
                                            {item.checkedMachines?.[
                                              machineId
                                            ] && (
                                              <Check className='h-3 w-3 text-green-500' />
                                            )}
                                          </div>
                                          <span className='text-xs truncate'>
                                            {details.name} (#{machineId})
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            {isGroup && (
                              <span className='text-[8px] text-primary/60 font-medium uppercase tracking-tighter mt-0.5'>
                                Группа
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className='px-1 py-2 md:px-2 text-right text-xs sm:text-sm overflow-hidden'>
                        <span className='whitespace-nowrap'>
                          {item.amount} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className='px-1 py-2 md:px-2 text-right'>
                        <Popover
                          open={activeDetail === item.name}
                          onOpenChange={open =>
                            setActiveHints(prev => ({
                              ...prev,
                              activeDetail: open ? item.name : null,
                            }))
                          }
                        >
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
                              <div className='font-medium text-sm leading-none border-b pb-2 flex justify-between items-center gap-2'>
                                <h4 className='font-medium leading-none'>
                                  Детализация
                                </h4>{' '}
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='h-6 w-6 rounded-full'
                                  onClick={e => {
                                    e.stopPropagation();
                                    setActiveHints(prev => ({
                                      ...prev,
                                      activeDetail: null,
                                    }));
                                  }}
                                >
                                  <X className='h-3 w-3 text-[#F44336]' />
                                </Button>
                              </div>
                              <p className='text-sm text-muted-foreground'>
                                Разбивка для: <strong>{item.name}</strong>
                              </p>
                            </div>
                            <div className='mt-4 space-y-1'>
                              {Object.entries(
                                item.salesBreakdown || item.breakdown,
                              )
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
                                      {Math.ceil(details.amount)}{' '}
                                      {details.name.includes('стакан')
                                        ? `шт.`
                                        : item.unit}
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
