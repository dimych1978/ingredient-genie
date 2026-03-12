'use client';

import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MASTER_MACHINE_IDS, planogramsHardCode, PRODUCT_GROUPS, machineIngredients } from '@/lib/data';
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import { useScheduleState } from '@/components/context/ScheduleStateContext';
import { Input } from '@/components/ui/input';
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
import { Loader2, Search, RefreshCcw, X, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import type { TelemetronSaleItem } from '@/types/telemetron';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const ALL_CONSTITUENTS_NORMALIZED = new Set(
  Object.values(PRODUCT_GROUPS).flat().map(normalize)
);

export const InventoryManager = () => {
  const { stockOnHand, setStockOnHand } = useScheduleState();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getSalesByProducts } = useTelemetronApi();

  const loadMasterCatalog = useCallback(
    async (force = false) => {
      const cachedCatalog = localStorage.getItem('master_catalog');
      if (cachedCatalog && !force) {
        setCatalog(JSON.parse(cachedCatalog));
        return;
      }

      setLoading(true);
      try {
        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateTo.getDate() - 30);

        const ingredientsSet = new Set<string>();
        const snacksSet = new Set<string>();

        // 1. Собираем все ингредиенты и расходники из конфигурации аппаратов
        Object.values(machineIngredients).forEach(modelIngredients => {
          modelIngredients.forEach(ing => {
            // Исключаем воду, её обычно не учитывают как товар "в руках"
            if (ing.name.toLowerCase() !== 'вода') {
              ingredientsSet.add(ing.name);
            }
          });
        });

        // 2. Загружаем продажи из мастер-аппаратов для снеков и бутылок
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

                // Если у товара есть ингредиенты - это кофейный напиток (Моккачино и т.д.), пропускаем
                const isDrink = sale.planogram.ingredients && sale.planogram.ingredients.length > 0;
                if (isDrink) return;

                // Извлекаем название товара без номера ячейки
                const match = sale.planogram.name.match(
                  /^\d+[A-Za-z]?\.\s*(.+)$/,
                );
                const cleanName = match ? match[1] : sale.planogram.name;
                
                if (cleanName && cleanName !== 'пр' && !cleanName.toLowerCase().includes('нет данных')) {
                  snacksSet.add(cleanName);
                }
              });
            }
          } catch (e) {
            console.error(`Ошибка загрузки каталога для ${id}:`, e);
          }
        });

        await Promise.all(promises);

        // 3. Добавляем захардкоженные бутылочные товары и названия групп к снекам
        planogramsHardCode.bottle.forEach(item => snacksSet.add(item));
        Object.keys(PRODUCT_GROUPS).forEach(groupName => snacksSet.add(groupName));

        // 4. Формируем финальный список: Сначала Ингредиенты, потом Снеки
        const sortedIngredients = Array.from(ingredientsSet).sort((a, b) =>
          a.localeCompare(b, 'ru'),
        );
        const sortedSnacks = Array.from(snacksSet).sort((a, b) =>
          a.localeCompare(b, 'ru'),
        );

        const fullCatalog = [...sortedIngredients, ...sortedSnacks];

        setCatalog(fullCatalog);
        localStorage.setItem('master_catalog', JSON.stringify(fullCatalog));
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

  useEffect(() => {
    if (matches.length > 0 && matches[matchIndex] !== undefined) {
      const element = document.getElementById(`inventory-item-${matches[matchIndex]}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [matchIndex, matches]);

  const handleStockChange = (itemName: string, value: string) => {
    if (/^\d{0,3}$/.test(value)) {
      setStockOnHand(prev => {
        const next = { ...prev, [itemName]: value };
        
        Object.entries(PRODUCT_GROUPS).forEach(([groupName, constituents]) => {
          if (constituents.includes(itemName)) {
            const sum = constituents.reduce(
              (acc, c) => acc + (parseInt(next[c] || '0') || 0),
              0
            );
            next[groupName] = sum.toString();
          }
        });
        
        return next;
      });
    }
  };

  const getGroupTotal = (groupName: string) => {
    const constituents = PRODUCT_GROUPS[groupName];
    if (!constituents) return stockOnHand[groupName] || '';
    
    return constituents.reduce(
      (sum, name) => sum + (parseInt(stockOnHand[name] || '0') || 0),
      0
    ).toString();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const nextMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    setMatchIndex(prev => (prev < matches.length - 1 ? prev + 1 : 0));
  };

  const prevMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    setMatchIndex(prev => (prev > 0 ? prev - 1 : matches.length - 1));
  };

  return (
    <div className='space-y-4'>
      <Card className='relative'>
        <CardHeader className='pb-3 sticky top-0 z-20 bg-background/95 backdrop-blur border-b'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Склад / Остатки в руках</CardTitle>
              <CardDescription>
                Ингредиенты в начале списка. Напитки из меню аппарата исключены.
              </CardDescription>
            </div>
            <button
              onClick={() => loadMasterCatalog(true)}
              className='p-2 hover:bg-muted rounded-full transition-colors'
              title='Обновить список товаров'
              disabled={loading}
            >
              <RefreshCcw
                className={cn(
                  'h-5 w-5 text-muted-foreground',
                  loading && 'animate-spin',
                )}
              />
            </button>
          </div>
          <div className='relative mt-4 flex items-center gap-2'>
            <div className="relative flex-1">
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
              <Input
                ref={inputRef}
                placeholder='Поиск по каталогу...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-9 pr-28 h-10'
              />
              {searchQuery && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-background/80 backdrop-blur-sm rounded-md shadow-sm border px-1">
                  <span className="text-[10px] font-mono text-muted-foreground px-1 border-r mr-1">
                    {matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : '0/0'}
                  </span>
                  <button
                    onClick={prevMatch}
                    disabled={matches.length <= 1}
                    className='p-1 hover:text-foreground disabled:opacity-30'
                  >
                    <ChevronUp className='w-4 h-4' />
                  </button>
                  <button
                    onClick={nextMatch}
                    disabled={matches.length <= 1}
                    className='p-1 hover:text-foreground disabled:opacity-30'
                  >
                    <ChevronDown className='w-4 h-4' />
                  </button>
                  <button
                    onClick={clearSearch}
                    className='p-2 text-muted-foreground hover:text-red-500 transition-colors border-l ml-1'
                    aria-label='Очистить поиск'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className='pt-6'>
          {loading && catalog.length === 0 ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2 className='h-8 w-8 animate-spin text-primary mr-3' />
              <p>Загрузка каталога товаров...</p>
            </div>
          ) : (
            <div className='border rounded-md'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название товара</TableHead>
                    <TableHead className='w-24 text-center'>Остаток</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCatalog.map((item, index) => {
                    const isGroup = !!PRODUCT_GROUPS[item];
                    const isConstituent = ALL_CONSTITUENTS_NORMALIZED.has(normalize(item));
                    const isMatch = searchQuery.trim() !== '' && item.toLowerCase().includes(searchQuery.toLowerCase());
                    const isCurrentMatch = isMatch && matches[matchIndex] === index;
                    
                    return (
                      <TableRow 
                        key={item} 
                        id={`inventory-item-${index}`}
                        className={cn(
                          isGroup && 'bg-primary/5',
                          isMatch && 'bg-yellow-500/10',
                          isCurrentMatch && 'bg-yellow-500/30 ring-2 ring-yellow-500 ring-inset relative z-10'
                        )}
                      >
                        <TableCell className='text-sm font-medium'>
                          <div className='flex items-center gap-2'>
                            <span className="capitalize">{item}</span>
                            {isGroup && <Info className='h-3 w-3 text-primary opacity-50' />}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isGroup ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className='relative cursor-pointer'>
                                  <Input
                                    value={getGroupTotal(item)}
                                    readOnly
                                    className='h-8 text-center bg-muted/50 font-bold border-primary/20'
                                  />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className='w-80'>
                                <div className='space-y-3'>
                                  <h4 className='font-medium text-sm leading-none border-b pb-2'>
                                    {item}
                                  </h4>
                                  <div className='grid gap-3'>
                                    {PRODUCT_GROUPS[item].map(constituent => (
                                      <div key={constituent} className='flex items-center justify-between gap-4'>
                                        <span className='text-xs text-muted-foreground leading-tight'>
                                          {constituent}
                                        </span>
                                        <Input
                                          type='number'
                                          value={stockOnHand[constituent] || ''}
                                          onChange={e => handleStockChange(constituent, e.target.value)}
                                          placeholder='0'
                                          className='h-8 w-16 text-center text-xs'
                                          inputMode='numeric'
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Input
                              type='number'
                              value={stockOnHand[item] || ''}
                              onChange={e => handleStockChange(item, e.target.value)}
                              placeholder='0'
                              className='h-8 text-center'
                              inputMode='numeric'
                              disabled={isConstituent && !searchQuery}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {displayCatalog.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className='text-center py-10 text-muted-foreground'
                      >
                        Каталог пуст. Нажмите кнопку обновления.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
