'use client';

import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  MASTER_MACHINE_IDS,
  planogramsHardCode,
  PRODUCT_GROUPS,
  machineIngredients,
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
import type { TelemetronSaleItem } from '@/types/telemetron';
import { SoundButton } from './ui/sound-button';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const ALL_CONSTITUENTS_NORMALIZED = new Set(
  Object.values(PRODUCT_GROUPS).flat().map(normalize),
);

const ALL_COFFEE_INGREDIENTS = new Set(
  Object.values(machineIngredients).flatMap(modelIngs =>
    modelIngs.map(ing => normalize(ing.name)),
  ),
);

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
  const [localManualInput, setLocalManualInput] = useState(
    dateStr ? format(parseISO(dateStr), 'dd.MM.yy') : '',
  );
  const [open, setOpen] = useState(false);

  const handleManualInput = (val: string) => {
    setLocalManualInput(val);
    const cleaned = val.replace(/\D/g, '').slice(0, 6);

    if (cleaned.length === 6) {
      const parsedDate = parse(cleaned, 'ddMMyy', new Date());
      if (isValid(parsedDate)) {
        onDateSelect(parsedDate);
        setOpen(false);
      }
    } else if (cleaned.length === 0) {
      onDateSelect(undefined);
    }
  };

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
        <div className='p-3 border-b bg-muted/30 space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate max-w-[150px]'>
              {itemName}
            </span>
            {dateStr && (
              <Button
                variant='ghost'
                size='sm'
                className='h-6 text-[10px] text-destructive px-2'
                onClick={() => {
                  onDateSelect(undefined);
                  setLocalManualInput('');
                }}
              >
                Сбросить
              </Button>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <Keyboard className='h-3.5 w-3.5 text-muted-foreground' />
            <Input
              placeholder='ДД.ММ.ГГ'
              value={localManualInput}
              onChange={e => handleManualInput(e.target.value)}
              className='h-8 text-xs font-mono'
            />
          </div>
        </div>
        <Calendar
          mode='single'
          selected={dateStr ? parseISO(dateStr) : undefined}
          defaultMonth={dateStr ? parseISO(dateStr) : undefined}
          onSelect={date => {
            onDateSelect(date);
            if (date) setLocalManualInput(format(date, 'dd.MM.yy'));
            else setLocalManualInput('');
          }}
          locale={ru}
        />
      </PopoverContent>
    </Popover>
  );
};

export const InventoryManager = () => {
  const { stockOnHand, setStockOnHand, expirationDates, setExpirationDates } =
    useScheduleState();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [activeConstituent, setActiveConstituent] = useState<string | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollPositionRef = useRef(0);
  const { getSalesByProducts } = useTelemetronApi();

  const loadMasterCatalog = useCallback(
    async (force = false) => {
      // 1. Пытаемся взять из кеша, если не force
      const cachedCatalog = localStorage.getItem('master_catalog');
      if (cachedCatalog && !force) {
        let parsed = JSON.parse(cachedCatalog);

        const stopWords = [
          'Лимонад "Добрый" 0,5 в ассорт.',
          'Лимонад "Добрый" ж/б 0,33 в ассорт.',
          'Лимонад "Добрый Фанта" 0,5',
          'Лимонад "Добрый Фанта" 0,33 ж/б',
          'Лимонад "Добрый Спрайт" 0,33 ж/б',
          'Лимонад "Добрый Спрайт" 0,5',
          'Добрый/Черноголовка вода+сок в ассорт.',
          'Лимонад Черноголовка 0,5 в ассорт.',
          'Лимонад Черноголовка ж/б 0.33 в ассорт.',
          'Лимонад Фрустайл в ассорт. 0,5',
          'Лимонад Фрустайл ж/б в ассорт. 0,33',
          'Сок Добрый в ассорт 0.33',
          'Сок Рич в ассорт.',
          'Конф. Простое Чудо 40г',
          'Меллер/Ментос',
          'Милкис напиток 0.3',
          'Калинов морс/Русморс 0,5',
          'Калинов морс 0,5',
          'нет данных',
          'тест',
          'пр',
          'telemetron',
        ];

        // Фильтруем устаревшие названия
        const isDeprecated = (name: string) => {
          const lower = name.toLowerCase();
          return stopWords.some(word => lower.includes(word));
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
            if (ing.name.toLowerCase() !== 'вода') {
              ingredientsSet.add(ing.name.trim());
            }
          });
        });

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
          'Лимонад "Добрый" 0,5 в ассорт.',
          'Лимонад "Добрый" ж/б 0,33 в ассорт.',
          'Лимонад "Добрый Фанта" 0,5',
          'Лимонад "Добрый Фанта" 0,33 ж/б',
          'Лимонад "Добрый Спрайт" 0,33 ж/б',
          'Лимонад "Добрый Спрайт" 0,5',
          'Добрый/Черноголовка вода+сок в ассорт.',
          'Лимонад Черноголовка 0,5 в ассорт.',
          'Лимонад Черноголовка ж/б 0.33 в ассорт.',
          'Лимонад Фрустайл в ассорт. 0,5',
          'Лимонад Фрустайл ж/б в ассорт. 0,33',
          'Сок Добрый в ассорт 0.33',
          'Сок Рич в ассорт.',
          'Конф. Простое Чудо 40г',
          'Меллер/Ментос',
          'Милкис напиток 0.3',
          'Калинов морс/Русморс 0,5',
          'Калинов морс 0,5',
          'нет данных',
          'тест',
          'пр',
          'telemetron',
        ];

        const isDeprecated = (name: string) => {
          const lower = name.toLowerCase();
          return stopWords.some(word => lower.includes(word.toLowerCase()));
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

  const handleStockChange = (itemName: string, value: string) => {
    if (/^\d{0,3}$/.test(value)) {
      setStockOnHand(prev => {
        const next = { ...prev, [itemName]: value };

        Object.entries(PRODUCT_GROUPS).forEach(([groupName, constituents]) => {
          if (constituents.includes(itemName)) {
            const sum = constituents.reduce(
              (acc, c) => acc + (parseInt(next[c] || '0') || 0),
              0,
            );
            next[groupName] = sum.toString();
          }
        });

        return next;
      });
    }
  };

  const handleExpiryChange = (itemName: string, date: Date | undefined) => {
    setExpirationDates(prev => ({
      ...prev,
      [itemName]: date ? date.toISOString() : '',
    }));
  };

  const handleInputFocus = () => {
    scrollPositionRef.current = window.scrollY;
  };

  const handleInputBlur = () => {
    // Небольшая задержка, чтобы клавиатура успела скрыться
    setTimeout(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
    }, 50);
  };

  const handleStep = (itemName: string, delta: number) => {
    const currentValue = parseInt(stockOnHand[itemName] || '0') || 0;
    const newValue = Math.max(0, currentValue + delta);
    handleStockChange(itemName, newValue.toString());
  };

  const handleHintToggle = (name: string) => {
    setActiveHint(name);
    setTimeout(() => setActiveHint(null), 1000);
  };

  const handleConstituentHint = (name: string) => {
    setActiveConstituent(name);
    setTimeout(() => setActiveConstituent(null), 1000);
  };

  const getGroupTotal = (groupName: string) => {
    const constituents = PRODUCT_GROUPS[groupName];
    if (!constituents) return stockOnHand[groupName] || '';

    return constituents
      .reduce((sum, name) => sum + (parseInt(stockOnHand[name] || '0') || 0), 0)
      .toString();
  };

  const getExpiryStatus = (itemName: string) => {
    if (ALL_COFFEE_INGREDIENTS.has(normalize(itemName))) return 'ok';

    const groupItems = PRODUCT_GROUPS[itemName];
    if (groupItems) {
      const statuses = groupItems.map(gi => getExpiryStatus(gi));
      if (statuses.includes('critical')) return 'critical';
      if (statuses.includes('empty')) return 'empty';
      return 'ok';
    }

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
      </h4>
      <div className='grid gap-2'>
        {PRODUCT_GROUPS[item].map(constituent => (
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
                          <span className='font-mono text-red-500 font-bold'>
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
                    {format(parseISO(expirationDates[constituent]), 'dd.MM.yy')}
                  </span>
                )}
              </div>
            </div>
            {mode === 'stock' && (
              <div className='flex items-center gap-1'>
                <SoundButton
                  variant='outline'
                  size='icon'
                  className='h-6 w-6 rounded-full p-1.5'
                  soundType='decrement'
                  onClick={() => handleStep(constituent, -1)}
                >
                  <Minus className='h-2.5 w-2.5' />
                </SoundButton>
                <Input
                  type='number'
                  value={
                    stockOnHand[constituent] === '0'
                      ? ''
                      : stockOnHand[constituent] || ''
                  }
                  onChange={e => handleStockChange(constituent, e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  className='h-7 w-10 text-center text-[11px] p-0'
                  inputMode='numeric'
                  placeholder='0'
                />
                <SoundButton
                  variant='outline'
                  size='icon'
                  className='h-6 w-6 rounded-full p-1.5'
                  soundType='increment'
                  onClick={() => handleStep(constituent, 1)}
                >
                  <Plus className='h-2.5 w-2.5' />
                </SoundButton>
              </div>
            )}
          </div>
        ))}
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
          <div className='relative mt-2 flex items-center gap-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
              <Input
                ref={inputRef}
                placeholder='Поиск по каталогу...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-8 pr-24 h-9 text-xs'
              />
              {searchQuery && (
                <div className='absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-background/80 backdrop-blur-sm rounded-md shadow-sm border px-1'>
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
                            <Popover>
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
                              <PopoverContent className='w-auto max-w-[280px] p-3 bg-popover/95 backdrop-blur-sm shadow-xl'>
                                <div className='space-y-1'>
                                  <p className='font-medium text-sm'>{item}</p>
                                  {expiryDate && !isGroup && (
                                    <p className='text-xs text-muted-foreground'>
                                      Срок до:{' '}
                                      <span className='font-mono text-red-500 font-bold'>
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
                            <Popover>
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
                                onClick={() => handleStep(item, -1)}
                              >
                                <Minus className='h-2.5 w-2.5 sm:h-3 sm:w-3' />
                              </SoundButton>
                              <Input
                                type='number'
                                value={
                                  stockOnHand[item] === '0'
                                    ? ''
                                    : stockOnHand[item] || ''
                                }
                                onChange={e =>
                                  handleStockChange(item, e.target.value)
                                }
                                className='h-7 w-9 sm:w-12 text-center p-0 text-[11px]'
                                inputMode='numeric'
                                placeholder='0'
                              />
                              <SoundButton
                                variant='outline'
                                size='icon'
                                className='h-6 w-6 sm:h-7 sm:w-7 rounded-full p-1.5'
                                soundType='increment'
                                onClick={() => handleStep(item, 1)}
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
        </CardContent>
      </Card>
    </div>
  );
};
