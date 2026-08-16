'use client';

import { cn, handleDateInput } from '@/lib/utils';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  MASTER_MACHINE_IDS,
  planogramsHardCode,
  PRODUCT_GROUPS,
  machineIngredients,
  allMachines,
  ALL_COFFEE_INGREDIENTS,
} from '@/lib/data';
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import { useScheduleState } from '@/components/context/ScheduleStateContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Loader2,
  Search,
  RefreshCcw,
  X,
  Info,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  CalendarDays,
  AlertCircle,
  Keyboard,
} from 'lucide-react';
import { format, differenceInDays, parseISO, isValid, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Ingredient, TelemetronSaleItem } from '@/types/telemetron';
import { SoundButton } from './ui/sound-button';
import { useStockCounter } from '@/hooks/useStockCounter';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const ALL_CONSTITUENTS_NORMALIZED = new Set(
  Object.values(PRODUCT_GROUPS).flat().map(normalize),
);

const getDisplayNames = (ing: Ingredient) => {
  const result: string[] = [];

  if (ing.name.toLowerCase() === 'вода') return result;

  if (ing.size) {
    const prefix = ing.name.includes('крышк') ? 'крышки' : 'стаканы';
    result.push(`${prefix} ${ing.size === 'big' ? 'большие' : 'малые'}`);
  } else if (ing.hasSizes) {
    const prefix = ing.name.includes('крышк') ? 'крышки' : 'стаканы';
    result.push(`${prefix} большие`, `${prefix} малые`);
  } else if (ing.syrupOptions) {
    ing.syrupOptions.forEach(syrup => result.push(`сироп ${syrup.name}`));
  } else {
    result.push(ing.name.trim());
  }

  return result;
};

interface ExpiryPickerProps {
  itemName: string;
  status: 'ok' | 'critical' | 'empty';
  dateStr?: string;
  onDateSelect: (date: Date | undefined) => void;
}

const ExpiryPicker = ({
  itemName,
  status,
  dateStr,
  onDateSelect,
}: ExpiryPickerProps) => {
  const isCoffee = ALL_COFFEE_INGREDIENTS.has(normalize(itemName));
  const [open, setOpen] = useState(false);

  if (isCoffee) {
    return (
      <div className='flex justify-center'>
        <div className='h-2 w-2 rounded-full bg-green-500/40' />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={cn(
            'h-6 w-6 rounded-full transition-colors',
            status === 'empty' &&
              'text-orange-500 hover:text-orange-600 hover:bg-orange-500/10',
            status === 'critical' &&
              'text-red-600 hover:text-red-700 bg-red-500/20 hover:bg-red-500/30',
            status === 'ok' &&
              'text-green-600 hover:text-green-700 hover:bg-green-500/10',
          )}
        >
          {status === 'empty' ? (
            <AlertCircle className='h-3.5 w-3.5' />
          ) : (
            <CalendarDays className='h-3.5 w-3.5' />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          dateStr={dateStr}
          selected={dateStr ? parseISO(dateStr) : undefined}
          defaultMonth={dateStr ? parseISO(dateStr) : undefined}
          onSelect={date => {
            onDateSelect(date);
          }}
          onDateSelect={onDateSelect}
          onClose={() => setOpen(false)}
          locale={ru}
        />
      </PopoverContent>
    </Popover>
  );
};

export const InventoryManager = () => {
  const {
    // stockOnHand,
    // setStockOnHand,
    expirationDates,
    setExpirationDates,
    machineItemExpiry,
    setMachineItemExpiryDate,
  } = useScheduleState();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [activeConstituent, setActiveConstituent] = useState<string | null>(
    null,
  );
  const [activeGroup, setActiveGroup] = useState<{
    expiry: string | null;
    stock: string | null;
  }>({ expiry: null, stock: null });
  const [showHistory, setShowHistory] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollPositionRef = useRef(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getSalesByProducts } = useTelemetronApi();

  const { getValue, setValue, increment, decrement } = useStockCounter();

  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('search_history') || '[]');
    } catch {
      return [];
    }
  });

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

  const loadMasterCatalog = useCallback(
    async (force = false) => {
      // 1. Пытаемся взять из кеша, если не force
      const cachedCatalog = localStorage.getItem('master_catalog');
      if (cachedCatalog && !force) {
        let parsed = JSON.parse(cachedCatalog);

        const stopWords = [
          'Кофе',
          'Амаретто',
          'Лимонад "Добрый" 0,5 в ассорт.',
          'Лимонад "Добрый" ж/б 0,33 в ассорт.',
          'Лимонад "Добрый Фанта" 0,5',
          'Лимонад "Добрый Фанта" 0,33 ж/б',
          'Лимонад "Добрый Апельсин 0,33 ж/б',
          'Лимонад "Добрый Апельсин 0,5',
          'Лимонад "Добрый Спрайт" 0,33 ж/б',
          'Лимонад "Добрый Спрайт" 0,5',
          'Добрый/Черноголовка вода+сок в ассорт.',
          'Лимонад Черноголовка 0,5 в ассорт.',
          'Лимонад Черноголовка ж/б 0.33 в ассорт.',
          'Лимонад Фрустайл в ассорт. 0,5',
          'Лимонад Фрустайл ж/б в ассорт. 0,33',
          'Сок Добрый в ассорт 0.33',
          'Сок Рич в ассорт.',
          'Сок Палпи в ассорт. 0.45',
          'Конф. Простое Чудо 40г',
          'Меллер/Ментос',
          'Милкис напиток 0.3',
          'Калинов морс/Русморс 0,5',
          'Калинов морс 0,5',
          'Печенье Форсайт 190гр',
          'Степ/ ДаЁжь 42гр.',
          'Печенье Школьн. шпарг. 50гр./Посольское 44гр.',
          'Мармелад Яшкино/frunel',
          'нет данных',
          'тест',
          'пр',
          'telemetron',
        ];

        // Фильтруем устаревшие названия
        const isDeprecated = (name: string) => {
          const lower = name.toLowerCase();
          return stopWords.some(word => lower === word.toLowerCase());
        };

        const filtered = parsed.filter((item: string) => !isDeprecated(item));

        if (filtered.length !== parsed.length) {
          console.log(
            `Отфильтровано ${parsed.length - filtered.length} устаревших товаров`,
          );
          // Сохраняем отфильтрованный каталог обратно в localStorage
          localStorage.setItem('master_catalog', JSON.stringify(filtered));
          parsed = filtered;
        }

        setCatalog(parsed);
        return;
      }

      // 2. Принудительное обновление — загружаем свежие данные из API
      setLoading(true);
      try {
        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateTo.getDate() - 30);

        const ingredientsSet = new Set<string>();
        const snacksSet = new Set<string>();

        // Собираем ингредиенты из конфигурации
        Object.values(machineIngredients).forEach(modelIngredients => {
          modelIngredients.forEach(ing => {
            getDisplayNames(ing).forEach(name => ingredientsSet.add(name));
          });
        });
        ingredientsSet.add('кофе камора');
        ingredientsSet.add('кофе жардин');
        // Загружаем продажи из мастер-аппаратов
        const promises = MASTER_MACHINE_IDS.map(async id => {
          try {
            const salesData = await getSalesByProducts(
              id,
              format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
              format(dateTo, 'yyyy-MM-dd HH:mm:ss'),
            );
            if (salesData.data) {
              salesData.data.forEach((sale: TelemetronSaleItem) => {
                if (!sale.planogram?.name) return;

                const isDrink =
                  sale.planogram.ingredients &&
                  sale.planogram.ingredients.length > 0;
                if (isDrink) return;

                const match = sale.planogram.name.match(
                  /^[0-9A-Za-z]+\.\s*(.+)$/,
                );
                const cleanName = (
                  match ? match[1] : sale.planogram.name
                ).trim();

                const lowerName = cleanName.toLowerCase();
                const isInvalid =
                  !cleanName ||
                  cleanName === 'пр' ||
                  lowerName.includes('нет данных') ||
                  lowerName === 'item' ||
                  lowerName === 'telemetron' ||
                  lowerName === 'тест';

                if (!isInvalid) {
                  snacksSet.add(cleanName);
                }
              });
            }
          } catch (e) {
            console.error(`Ошибка загрузки каталога для ${id}:`, e);
          }
        });

        await Promise.all(promises);

        // Добавляем бутылочные товары и группы
        planogramsHardCode.bottle.forEach(item => snacksSet.add(item.trim()));
        Object.keys(PRODUCT_GROUPS).forEach(groupName =>
          snacksSet.add(groupName.trim()),
        );

        // Сортируем
        const sortedIngredients = Array.from(ingredientsSet).sort((a, b) =>
          a.localeCompare(b, 'ru'),
        );
        const sortedSnacks = Array.from(snacksSet).sort((a, b) =>
          a.localeCompare(b, 'ru'),
        );

        const fullCatalog = [...sortedIngredients, ...sortedSnacks];

        const stopWords = [
          'Кофе',
          'Лимонад "Добрый" 0,5 в ассорт.',
          'Лимонад "Добрый" ж/б 0,33 в ассорт.',
          'Лимонад "Добрый Фанта" 0,5',
          'Лимонад "Добрый Фанта" 0,33 ж/б',
          'Лимонад "Добрый Апельсин 0,33 ж/б',
          'Лимонад "Добрый Апельсин 0,5',
          'Лимонад "Добрый Спрайт" 0,33 ж/б',
          'Лимонад "Добрый Спрайт" 0,5',
          'Добрый/Черноголовка вода+сок в ассорт.',
          'Лимонад Черноголовка 0,5 в ассорт.',
          'Лимонад Черноголовка ж/б 0.33 в ассорт.',
          'Лимонад Фрустайл в ассорт. 0,5',
          'Лимонад Фрустайл ж/б в ассорт. 0,33',
          'Сок Добрый в ассорт 0.33',
          'Сок Рич в ассорт.',
          'Сок Палпи в ассорт. 0.45',
          'Конф. Простое Чудо 40г',
          'Меллер/Ментос',
          'Милкис напиток 0.3',
          'Калинов морс/Русморс 0,5',
          'Калинов морс 0,5',
          'Печенье Форсайт 190гр',
          'Степ/ ДаЁжь 42гр.',
          'Печенье Школьн. шпарг. 50гр./Посольское 44гр.',
          'Мармелад Яшкино/frunel',
          'нет данных',
          'тест',
          'пр',
          'telemetron',
        ];

        const isDeprecated = (name: string) => {
          const lower = name.toLowerCase();
          return stopWords.some(word => lower === word.toLowerCase());
        };

        const filteredCatalog = fullCatalog.filter(item => !isDeprecated(item));

        if (filteredCatalog.length !== fullCatalog.length) {
          console.log(
            `Отфильтровано ${fullCatalog.length - filteredCatalog.length} устаревших товаров из API`,
          );
        }

        // Сохраняем в state и localStorage уже отфильтрованный каталог
        setCatalog(filteredCatalog);
        localStorage.setItem('master_catalog', JSON.stringify(filteredCatalog));
      } catch (error) {
        console.error('Ошибка формирования мастер-каталога:', error);
      } finally {
        setLoading(false);
      }
    },
    [getSalesByProducts],
  );

  useEffect(() => {
    loadMasterCatalog();
  }, [loadMasterCatalog]);

  const displayCatalog = useMemo(() => {
    if (!searchQuery.trim()) {
      return catalog.filter(item => {
        const isGroupParent = !!PRODUCT_GROUPS[item];
        const isConstituent = ALL_CONSTITUENTS_NORMALIZED.has(normalize(item));
        return isGroupParent || !isConstituent;
      });
    }
    return catalog;
  }, [catalog, searchQuery]);

  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return displayCatalog.reduce((acc, item, index) => {
      if (item.toLowerCase().includes(lowerQuery)) {
        acc.push(index);
      }
      return acc;
    }, [] as number[]);
  }, [displayCatalog, searchQuery]);

  useEffect(() => {
    setMatchIndex(0);
  }, [searchQuery]);

  const scrollToMatch = useCallback(
    (index: number, retryCount: number = 0) => {
      if (matches.length > 0 && matches[index] !== undefined) {
        const element = document.getElementById(
          `inventory-item-${matches[index]}`,
        );
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'center' });
        } else if (retryCount < 3) {
          setTimeout(() => scrollToMatch(index, retryCount + 1), 50);
        }
      }
    },
    [matches],
  );

  useEffect(() => {
    scrollToMatch(matchIndex);
  }, [matchIndex, matches, scrollToMatch]);

  const handleExpiryChange = (itemName: string, date: Date | undefined) => {
    // Сохраняем на складе
    setExpirationDates(prev => ({
      ...prev,
      [itemName]: date ? date.toISOString() : '',
    }));

    // Если дата не установлена — выходим
    if (!date) return;

    const newDate = date;

    // Все аппараты с ручной датой для этого товара
    const machineKeys = Object.keys(machineItemExpiry).filter(key =>
      key.endsWith(`_${itemName}`),
    );

    // Обновляем только те, у которых дата раньше новой
    machineKeys.forEach(key => {
      const machineId = key.split('_')[0];
      const currentDateStr = machineItemExpiry[key];
      if (!currentDateStr) return;

      const currentDate = parseISO(currentDateStr);
      if (!isValid(currentDate)) return;

      // ✅ Если ручная дата раньше новой — продлеваем
      if (currentDate < newDate) {
        setMachineItemExpiryDate(machineId, itemName, newDate);
      }
    });
  };

  const handleInputFocus = () => {
    scrollPositionRef.current = window.scrollY;
  };

  const handleInputBlur = () => {
    // Небольшая задержка, чтобы клавиатура успела скрыться
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
    }, 100);
  };

  const handleHintToggle = (name: string) => {
    setActiveHint(name);
    const status = getExpiryStatus(name);
    if (status !== 'critical') {
      setTimeout(() => setActiveHint(null), 1500);
    }
  };

  const handleConstituentHint = (name: string) => {
    setActiveConstituent(name);
    setTimeout(() => setActiveConstituent(null), 1000);
  };

  const getGroupTotal = (groupName: string) => {
    const constituents = PRODUCT_GROUPS[groupName];
    if (!constituents) return '';

    const sum = constituents.reduce((acc, constituent) => {
      return acc + getValue(constituent);
    }, 0);
    return sum.toString();
  };

  const getExpiryStatus = (itemName: string) => {
    // Кофейные ингредиенты без срока
    if (ALL_COFFEE_INGREDIENTS.has(normalize(itemName))) return 'ok';

    // 1. Проверяем все аппараты с ручной датой
    const machineKeys = Object.keys(machineItemExpiry).filter(key =>
      key.endsWith(`_${itemName}`),
    );

    let hasMachineDate = false;
    let isAnyCritical = false;

    machineKeys.forEach(key => {
      const dateStr = machineItemExpiry[key];
      if (!dateStr) return;
      hasMachineDate = true;
      const expiryDate = parseISO(dateStr);
      if (!isValid(expiryDate)) return;
      const daysLeft = differenceInDays(expiryDate, new Date());
      if (daysLeft <= 14) {
        isAnyCritical = true;
      }
    });

    // Если есть критический срок в любом аппарате — возвращаем 'critical'
    if (isAnyCritical) return 'critical';

    // Если есть даты в аппаратах, но все они > 14 дней — 'ok'
    if (hasMachineDate) return 'ok';

    // 2. Если нет дат в аппаратах — проверяем дату со склада
    const dateStr = expirationDates[itemName];
    if (!dateStr) return 'empty';
    const expiryDate = parseISO(dateStr);
    if (!isValid(expiryDate)) return 'empty';
    const daysLeft = differenceInDays(expiryDate, new Date());
    if (daysLeft <= 14) return 'critical';
    return 'ok';
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const nextMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    const nextIdx = matchIndex < matches.length - 1 ? matchIndex + 1 : 0;
    setMatchIndex(nextIdx);
    // Принудительный скролл с задержкой, чтобы сработал после скрытия клавиатуры
    setTimeout(() => scrollToMatch(nextIdx), 50);
  };

  const prevMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    const prevIdx = matchIndex > 0 ? matchIndex - 1 : matches.length - 1;
    setMatchIndex(prevIdx);
    setTimeout(() => scrollToMatch(prevIdx), 50);
  };

  const renderGroupDetails = (item: string, mode: 'expiry' | 'stock') => (
    <div className='space-y-3 max-w-full'>
      <h4 className='font-medium text-sm leading-none border-b pb-2 flex items-center justify-between'>
        {item}
        <Info className='h-3 w-3 opacity-40' />
        <Button
          variant='ghost'
          size='icon'
          className='h-6 w-6 rounded-full'
          onClick={e => {
            e.stopPropagation();
            setActiveGroup({ expiry: null, stock: null });
          }}
        >
          <X className='h-3 w-3 text-[#F44336]' />
        </Button>
      </h4>
      <div className='grid gap-2'>
        {PRODUCT_GROUPS[item].map(constituent => {
          const realKey = constituent;

          return (
            <div
              key={constituent}
              className='flex items-center justify-between gap-2 p-1 rounded hover:bg-muted/20 min-w-0'
            >
              <div className='flex items-center gap-1.5 flex-1 min-w-0'>
                {mode === 'expiry' && (
                  <ExpiryPicker
                    itemName={constituent}
                    status={getExpiryStatus(constituent)}
                    dateStr={expirationDates[constituent]}
                    onDateSelect={d => handleExpiryChange(constituent, d)}
                  />
                )}
                <div className='flex flex-col min-w-0'>
                  <Popover
                    open={activeConstituent === constituent}
                    onOpenChange={open => !open && setActiveConstituent(null)}
                  >
                    <PopoverTrigger asChild>
                      <span
                        className='text-[11px] text-muted-foreground leading-tight truncate cursor-pointer'
                        onClick={() => handleConstituentHint(constituent)}
                      >
                        {constituent}
                      </span>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto max-w-[280px] p-3 bg-popover/95 backdrop-blur-sm shadow-xl'>
                      <div className='space-y-1'>
                        <p className='font-medium text-sm'>{constituent}</p>
                        {expirationDates[constituent] && (
                          <p className='text-xs text-muted-foreground'>
                            Срок до:{' '}
                            <span
                              className={cn(
                                'font-mono font-bold',
                                getExpiryStatus(constituent) === 'critical'
                                  ? 'text-red-500'
                                  : 'text-green-500',
                              )}
                            >
                              {format(
                                parseISO(expirationDates[constituent]),
                                'dd.MM.yy',
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {mode === 'expiry' && expirationDates[constituent] && (
                    <span className='text-[9px] font-mono text-muted-foreground'>
                      до{' '}
                      {format(
                        parseISO(expirationDates[constituent]),
                        'dd.MM.yy',
                      )}
                    </span>
                  )}
                </div>
              </div>
              {mode === 'stock' && (
                <div className='flex items-center gap-1'>
                  \{' '}
                  <SoundButton
                    variant='outline'
                    size='icon'
                    className='h-6 w-6 rounded-full p-1.5'
                    soundType='decrement'
                    onClick={() => decrement(realKey)}
                  >
                    <Minus className='h-2.5 w-2.5' />
                  </SoundButton>
                  <Input
                    type='number'
                    value={getValue(realKey) === 0 ? '' : getValue(realKey)}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setValue(realKey, val);
                    }}
                    className='h-7 w-10 text-center text-[11px] p-0'
                    inputMode='numeric'
                    placeholder='0'
                  />
                  <SoundButton
                    variant='outline'
                    size='icon'
                    className='h-6 w-6 rounded-full p-1.5'
                    soundType='increment'
                    onClick={() => increment(realKey)}
                  >
                    <Plus className='h-2.5 w-2.5' />
                  </SoundButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className='space-y-4'>
      <Card className='relative'>
        <CardHeader className='pb-2 px-2 sm:px-6 sticky top-0 z-20 bg-background/95 backdrop-blur border-b'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-lg sm:text-2xl'>
                Склад / Остатки
              </CardTitle>
              <CardDescription className='text-[10px] sm:text-sm'>
                Нажмите на иконку календаря для установки срока.
              </CardDescription>
            </div>
            <button
              onClick={() => loadMasterCatalog(true)}
              className='p-1.5 hover:bg-muted rounded-full transition-colors'
              title='Обновить список товаров'
              disabled={loading}
            >
              <RefreshCcw
                className={cn(
                  'h-4 w-4 text-muted-foreground',
                  loading && 'animate-spin',
                )}
              />
            </button>
          </div>
        </CardHeader>
        <CardContent className='pt-2 px-0 sm:px-6'>
          {loading && catalog.length === 0 ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin text-primary mr-3' />
              <p className='text-xs'>Загрузка каталога...</p>
            </div>
          ) : (
            <div className='border-t sm:border rounded-md overflow-hidden'>
              <Table className='table-fixed w-full'>
                <TableHeader className='w-1/2'>
                  <TableRow className='bg-muted/20'>
                    <TableHead className='w-8 sm:w-12 text-center px-0.5'>
                      Срок
                    </TableHead>
                    <TableHead className='w-full min-w-0 px-1.5'>
                      Название
                    </TableHead>
                    <TableHead className='w-24 sm:w-40 text-center px-0.5'>
                      Остаток
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCatalog.map((item, index) => {
                    const isGroup = !!PRODUCT_GROUPS[item];
                    const isMatch =
                      searchQuery.trim() !== '' &&
                      item.toLowerCase().includes(searchQuery.toLowerCase());
                    const isCurrentMatch =
                      isMatch && matches[matchIndex] === index;
                    const expiryStatus = getExpiryStatus(item);
                    const expiryDate = expirationDates[item];

                    return (
                      <TableRow
                        key={item}
                        id={`inventory-item-${index}`}
                        className={cn(
                          isGroup && 'bg-primary/5',
                          isMatch && 'bg-yellow-500/10',
                          isCurrentMatch &&
                            'bg-yellow-500/30 ring-2 ring-yellow-500 ring-inset relative z-10',
                          expiryStatus === 'critical' &&
                            'bg-red-500/10 hover:bg-red-500/20',
                        )}
                      >
                        <TableCell className='px-0.5 text-center'>
                          {isGroup ? (
                            <Popover
                              open={activeGroup.expiry === item}
                              onOpenChange={open =>
                                setActiveGroup(prev => ({
                                  ...prev,
                                  expiry: open ? item : null,
                                }))
                              }
                            >
                              <PopoverTrigger asChild>
                                <div className='flex justify-center cursor-pointer outline-none'>
                                  <div
                                    className={cn(
                                      'h-6 w-6 rounded-full flex items-center justify-center transition-colors',
                                      expiryStatus === 'empty' &&
                                        'text-orange-500 hover:text-orange-600 hover:bg-orange-500/10',
                                      expiryStatus === 'critical' &&
                                        'text-red-600 bg-red-500/20',
                                      expiryStatus === 'ok' &&
                                        'text-green-600 hover:bg-green-500/10',
                                    )}
                                  >
                                    {expiryStatus === 'empty' ? (
                                      <AlertCircle className='h-3.5 w-3.5' />
                                    ) : (
                                      <CalendarDays className='h-3.5 w-3.5' />
                                    )}
                                  </div>{' '}
                                </div>
                              </PopoverTrigger>
                              <PopoverContent
                                className='w-72 sm:w-80 p-2'
                                align='start'
                              >
                                {renderGroupDetails(item, 'expiry')}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <ExpiryPicker
                              itemName={item}
                              status={expiryStatus}
                              dateStr={expiryDate}
                              onDateSelect={d => handleExpiryChange(item, d)}
                            />
                          )}
                        </TableCell>
                        <TableCell className='text-[12px] sm:text-sm font-medium px-1.5 py-2.5 break-words'>
                          <div className='flex flex-col min-w-0'>
                            <Popover
                              open={activeHint === item}
                              onOpenChange={open =>
                                !open && setActiveHint(null)
                              }
                            >
                              <PopoverTrigger asChild>
                                <span
                                  className={cn(
                                    'capitalize leading-tight cursor-pointer',
                                    isGroup && 'font-bold text-primary',
                                  )}
                                  onClick={() => handleHintToggle(item)}
                                >
                                  {item}
                                </span>
                              </PopoverTrigger>
                              <PopoverContent className='w-80 p-3 bg-popover/95 backdrop-blur-sm shadow-xl'>
                                <div className='space-y-2'>
                                  <div className='flex items-center justify-between border-b pb-2'>
                                    <h4 className='font-medium text-sm'>
                                      {item}
                                    </h4>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      className='h-6 w-6 rounded-full'
                                      onClick={e => {
                                        e.stopPropagation();
                                        setActiveHint(null);
                                      }}
                                    >
                                      <X className='h-3 w-3' />
                                    </Button>
                                  </div>

                                  {expiryStatus === 'critical' && expiryDate ? (
                                    <div className='space-y-1'>
                                      <p className='text-xs text-muted-foreground'>
                                        Срок до:{' '}
                                        <span className='font-mono font-bold text-red-500'>
                                          {format(
                                            parseISO(expiryDate!),
                                            'dd.MM.yy',
                                          )}
                                        </span>
                                      </p>
                                      <p className='text-xs text-muted-foreground mt-2'>
                                        Аппараты с установленными датами:
                                      </p>
                                      {Object.entries(machineItemExpiry)
                                        .filter(([key]) =>
                                          key.endsWith(`_${item}`),
                                        )
                                        .map(([key, dateStr]) => {
                                          const machineId = key.split('_')[0];
                                          const machine = allMachines.find(
                                            m => m.id === machineId,
                                          );

                                          const expiryDate = parseISO(dateStr);
                                          const daysLeft = isValid(expiryDate)
                                            ? differenceInDays(
                                                expiryDate,
                                                new Date(),
                                              )
                                            : 0;
                                          const isExpiryCritical =
                                            daysLeft <= 14;
                                          return (
                                            <div
                                              key={key}
                                              className='flex justify-between items-center text-xs py-1'
                                            >
                                              <span className='truncate pr-2'>
                                                {machine?.name || machineId} (#
                                                {machineId})
                                              </span>
                                              <span
                                                className={cn(
                                                  'font-mono font-bold flex-shrink-0',
                                                  isExpiryCritical
                                                    ? 'text-red-500'
                                                    : 'text-green-500',
                                                )}
                                              >
                                                {format(
                                                  parseISO(dateStr),
                                                  'dd.MM.yy',
                                                )}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      {Object.entries(machineItemExpiry).filter(
                                        ([key]) => key.endsWith(`_${item}`),
                                      ).length === 0 && (
                                        <p className='text-xs text-muted-foreground italic'>
                                          Нет аппаратов с установленными датами
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className='space-y-1'>
                                      {expiryDate && !isGroup && (
                                        <p className='text-xs text-muted-foreground'>
                                          Срок до:{' '}
                                          <span
                                            className={cn(
                                              'font-mono font-bold',
                                              (expiryStatus as string) ===
                                                'critical'
                                                ? 'text-red-500'
                                                : 'text-green-500',
                                            )}
                                          >
                                            {format(
                                              parseISO(expiryDate),
                                              'dd.MM.yy',
                                            )}
                                          </span>
                                        </p>
                                      )}
                                      {isGroup && (
                                        <p className='text-[10px] text-primary/70 uppercase'>
                                          Группа товаров
                                        </p>
                                      )}
                                      {!expiryDate && !isGroup && (
                                        <p className='text-xs text-muted-foreground'>
                                          Срок не установлен
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {expiryDate && !isGroup && (
                              <span
                                className={cn(
                                  'text-[8px] font-mono leading-none mt-0.5',
                                  expiryStatus === 'critical'
                                    ? 'text-red-600 font-bold'
                                    : 'text-muted-foreground',
                                )}
                              >
                                до {format(parseISO(expiryDate), 'dd.MM.yy')}
                              </span>
                            )}
                            {isGroup && (
                              <span className='text-[8px] text-primary/60 font-medium uppercase tracking-tighter mt-0.5'>
                                Группа
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className='px-0.5'>
                          {isGroup ? (
                            <Popover
                              open={activeGroup.stock === item}
                              onOpenChange={open =>
                                setActiveGroup(prev => ({
                                  ...prev,
                                  stock: open ? item : null,
                                }))
                              }
                            >
                              <PopoverTrigger asChild>
                                <div className='relative cursor-pointer px-1'>
                                  <Input
                                    value={
                                      getGroupTotal(item) === '0'
                                        ? ''
                                        : getGroupTotal(item)
                                    }
                                    readOnly
                                    className='h-7 text-center bg-muted/50 font-bold border-primary/20 text-[11px] p-0'
                                  />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent
                                className='w-72 sm:w-80  max-w-[calc(100vw-2rem)] p-2'
                                align='end'
                              >
                                {renderGroupDetails(item, 'stock')}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div className='flex items-center gap-0.5 sm:gap-2 justify-center'>
                              <SoundButton
                                variant='outline'
                                size='icon'
                                className='h-6 w-6 sm:h-7 sm:w-7 rounded-full p-1.5'
                                soundType='decrement'
                                onClick={() => decrement(item)}
                              >
                                <Minus className='h-2.5 w-2.5 sm:h-3 sm:w-3' />
                              </SoundButton>
                              <Input
                                type='number'
                                value={
                                  getValue(item) === 0 ? '' : getValue(item)
                                }
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setValue(item, val);
                                }}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                className='h-7 w-9 sm:w-12 text-center p-0 text-[11px]'
                                inputMode='numeric'
                                placeholder='0'
                              />
                              <SoundButton
                                variant='outline'
                                size='icon'
                                className='h-6 w-6 sm:h-7 sm:w-7 rounded-full p-1.5'
                                soundType='increment'
                                onClick={() => increment(item)}
                              >
                                <Plus className='h-2.5 w-2.5 sm:h-3 sm:w-3' />
                              </SoundButton>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className='sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t py-3 px-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
              <Input
                ref={inputRef}
                placeholder='Поиск по каталогу...'
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => !searchQuery && setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                className='pl-8 pr-24 h-9 text-xs'
              />

              {showHistory && !searchQuery && history.length > 0 && (
                <div className='absolute bottom-full left-0 right-0 bg-background border rounded-md shadow-lg mb-1 z-50 max-h-48 overflow-y-auto'>
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
                <div className='absolute right-12 top-1/2 -translate-y-1/2 flex items-center bg-background/80 backdrop-blur-sm rounded-md shadow-sm border px-1'>
                  <span className='text-[9px] font-mono text-muted-foreground px-1 border-r mr-1'>
                    {matches.length > 0
                      ? `${matchIndex + 1}/${matches.length}`
                      : '0/0'}
                  </span>
                  <button
                    onClick={prevMatch}
                    className='p-0.5 hover:text-foreground'
                  >
                    <ChevronUp className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={nextMatch}
                    className='p-0.5 hover:text-foreground'
                  >
                    <ChevronDown className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={clearSearch}
                    className='p-1.5 text-muted-foreground hover:text-red-500 transition-colors border-l ml-1'
                  >
                    <X className='w-3.5 h-3.5' />
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
