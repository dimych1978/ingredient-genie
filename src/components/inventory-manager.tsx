'use client';

import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MASTER_MACHINE_IDS, planogramsHardCode, PRODUCT_GROUPS, machineIngredients } from '@/lib/data';
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
  Keyboard
} from 'lucide-react';
import { format, differenceInDays, parseISO, isValid, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { TelemetronSaleItem } from '@/types/telemetron';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const ALL_CONSTITUENTS_NORMALIZED = new Set(
  Object.values(PRODUCT_GROUPS).flat().map(normalize)
);

const ALL_COFFEE_INGREDIENTS = new Set(
  Object.values(machineIngredients).flatMap(modelIngs => modelIngs.map(ing => normalize(ing.name)))
);

export const InventoryManager = () => {
  const { stockOnHand, setStockOnHand, expirationDates, setExpirationDates } = useScheduleState();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [manualDateInput, setManualDateInput] = useState<Record<string, string>>({});
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

        Object.values(machineIngredients).forEach(modelIngredients => {
          modelIngredients.forEach(ing => {
            if (ing.name.toLowerCase() !== 'вода') {
              ingredientsSet.add(ing.name.trim());
            }
          });
        });

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

                const isDrink = sale.planogram.ingredients && sale.planogram.ingredients.length > 0;
                if (isDrink) return;

                const match = sale.planogram.name.match(/^(?:[0-9A-Za-z]+\.)\s*(.+)$/);
                const cleanName = (match ? match[1] : sale.planogram.name).trim();
                
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

        planogramsHardCode.bottle.forEach(item => snacksSet.add(item.trim()));
        Object.keys(PRODUCT_GROUPS).forEach(groupName => snacksSet.add(groupName.trim()));

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

  const handleExpiryChange = (itemName: string, date: Date | undefined) => {
    setExpirationDates(prev => ({
      ...prev,
      [itemName]: date ? date.toISOString() : ''
    }));
  };

  const handleManualDateInput = (itemName: string, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4)}`;
    } else if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    }
    
    setManualDateInput(prev => ({ ...prev, [itemName]: formatted }));

    if (formatted.length === 10) {
      const parsedDate = parse(formatted, 'dd.MM.yyyy', new Date());
      if (isValid(parsedDate)) {
        handleExpiryChange(itemName, parsedDate);
      }
    }
  };

  const handleStep = (itemName: string, delta: number) => {
    const currentValue = parseInt(stockOnHand[itemName] || '0') || 0;
    const newValue = Math.max(0, currentValue + delta);
    handleStockChange(itemName, newValue.toString());
  };

  const getGroupTotal = (groupName: string) => {
    const constituents = PRODUCT_GROUPS[groupName];
    if (!constituents) return stockOnHand[groupName] || '';
    
    return constituents.reduce(
      (sum, name) => sum + (parseInt(stockOnHand[name] || '0') || 0),
      0
    ).toString();
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
    setMatchIndex(prev => (prev < matches.length - 1 ? prev + 1 : 0));
  };

  const prevMatch = (e: React.MouseEvent) => {
    e.preventDefault();
    setMatchIndex(prev => (prev > 0 ? prev - 1 : matches.length - 1));
  };

  const ExpiryPicker = ({ itemName }: { itemName: string }) => {
    const status = getExpiryStatus(itemName);
    const dateStr = expirationDates[itemName];
    const isCoffee = ALL_COFFEE_INGREDIENTS.has(normalize(itemName));
    const isGroup = !!PRODUCT_GROUPS[itemName];

    if (isCoffee) {
      return (
        <div className="flex justify-center">
          <div className="h-2 w-2 rounded-full bg-green-500/40" title="Бессрочный ингредиент" />
        </div>
      );
    }

    if (isGroup) {
      return (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-full transition-colors",
            status === 'empty' && "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10",
            status === 'critical' && "text-red-600 hover:text-red-700 bg-red-500/20 hover:bg-red-500/30",
            status === 'ok' && "text-green-600 hover:text-green-700 hover:bg-green-500/10"
          )}
        >
          {status === 'empty' ? <AlertCircle className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
        </Button>
      );
    }

    return (
      <Popover onOpenChange={(open) => {
        if (!open) setManualDateInput(prev => ({ ...prev, [itemName]: '' }));
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded-full transition-colors",
              status === 'empty' && "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10",
              status === 'critical' && "text-red-600 hover:text-red-700 bg-red-500/20 hover:bg-red-500/30",
              status === 'ok' && "text-green-600 hover:text-green-700 hover:bg-green-500/10"
            )}
          >
            {status === 'empty' ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate max-w-[150px]">
                {itemName}
              </span>
              {dateStr && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] text-destructive px-2"
                  onClick={() => handleExpiryChange(itemName, undefined)}
                >
                  Сбросить
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="ДД.ММ.ГГГГ"
                value={manualDateInput[itemName] || (dateStr ? format(parseISO(dateStr), 'dd.MM.yyyy') : '')}
                onChange={(e) => handleManualDateInput(itemName, e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
          <Calendar
            mode="single"
            selected={dateStr ? parseISO(dateStr) : undefined}
            onSelect={(date) => {
              handleExpiryChange(itemName, date);
            }}
            locale={ru}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  const renderGroupDetails = (item: string, mode: 'expiry' | 'stock') => (
    <div className='space-y-3'>
      <h4 className='font-medium text-sm leading-none border-b pb-2 flex items-center justify-between'>
        {item}
        <Info className="h-3 w-3 opacity-40" />
      </h4>
      <div className='grid gap-2'>
        {PRODUCT_GROUPS[item].map(constituent => (
          <div key={constituent} className='flex items-center justify-between gap-2 p-1 rounded hover:bg-muted/20'>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {mode === 'expiry' && <ExpiryPicker itemName={constituent} />}
              <div className="flex flex-col min-w-0">
                <span className='text-[11px] text-muted-foreground leading-tight truncate'>
                  {constituent}
                </span>
                {mode === 'expiry' && expirationDates[constituent] && (
                  <span className="text-[9px] font-mono text-muted-foreground">
                    до {format(parseISO(expirationDates[constituent]), 'dd.MM.yy')}
                  </span>
                )}
              </div>
            </div>
            {mode === 'stock' && (
              <div className='flex items-center gap-1'>
                <Button
                  variant="outline" size="icon" className="h-6 w-6 rounded-full"
                  onClick={() => handleStep(constituent, -1)}
                >
                  <Minus className="h-2.5 w-2.5" />
                </Button>
                <Input
                  type='number' value={stockOnHand[constituent] || ''}
                  onChange={e => handleStockChange(constituent, e.target.value)}
                  className='h-7 w-10 text-center text-[11px] p-0' inputMode='numeric'
                />
                <Button
                  variant="outline" size="icon" className="h-6 w-6 rounded-full"
                  onClick={() => handleStep(constituent, 1)}
                >
                  <Plus className="h-2.5 w-2.5" />
                </Button>
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
              <CardTitle className="text-lg sm:text-2xl">Склад / Остатки</CardTitle>
              <CardDescription className="text-[10px] sm:text-sm">
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
            <div className="relative flex-1">
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
              <Input
                ref={inputRef}
                placeholder='Поиск по каталогу...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-8 pr-24 h-9 text-xs'
              />
              {searchQuery && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-background/80 backdrop-blur-sm rounded-md shadow-sm border px-1">
                  <span className="text-[9px] font-mono text-muted-foreground px-1 border-r mr-1">
                    {matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : '0/0'}
                  </span>
                  <button onClick={prevMatch} className='p-0.5 hover:text-foreground'><ChevronUp className='w-3.5 h-3.5' /></button>
                  <button onClick={nextMatch} className='p-0.5 hover:text-foreground'><ChevronDown className='w-3.5 h-3.5' /></button>
                  <button onClick={clearSearch} className='p-1.5 text-muted-foreground hover:text-red-500 transition-colors border-l ml-1'><X className='w-3.5 h-3.5' /></button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className='pt-2 px-0 sm:px-6'>
          {loading && catalog.length === 0 ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin text-primary mr-3' />
              <p className="text-xs">Загрузка каталога...</p>
            </div>
          ) : (
            <div className='border-t sm:border rounded-md overflow-hidden'>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-8 sm:w-12 text-center px-0.5">Срок</TableHead>
                    <TableHead className="px-1.5">Название</TableHead>
                    <TableHead className='w-24 sm:w-40 text-center px-0.5'>Остаток</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCatalog.map((item, index) => {
                    const isGroup = !!PRODUCT_GROUPS[item];
                    const isMatch = searchQuery.trim() !== '' && item.toLowerCase().includes(searchQuery.toLowerCase());
                    const isCurrentMatch = isMatch && matches[matchIndex] === index;
                    const expiryStatus = getExpiryStatus(item);
                    const expiryDate = expirationDates[item];

                    return (
                      <TableRow 
                        key={item} 
                        id={`inventory-item-${index}`}
                        className={cn(
                          isGroup && 'bg-primary/5',
                          isMatch && 'bg-yellow-500/10',
                          isCurrentMatch && 'bg-yellow-500/30 ring-2 ring-yellow-500 ring-inset relative z-10',
                          expiryStatus === 'critical' && 'bg-red-500/10 hover:bg-red-500/20'
                        )}
                      >
                        <TableCell className="px-0.5 text-center">
                          {isGroup ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="flex justify-center cursor-pointer outline-none">
                                  <ExpiryPicker itemName={item} />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className='w-72 sm:w-80 p-2' align="start">
                                {renderGroupDetails(item, 'expiry')}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <ExpiryPicker itemName={item} />
                          )}
                        </TableCell>
                        <TableCell className='text-[12px] sm:text-sm font-medium px-1.5 py-2.5'>
                          <div className='flex flex-col min-w-0'>
                            <span className="capitalize truncate leading-tight">{item}</span>
                            {expiryDate && !isGroup && (
                              <span className={cn(
                                "text-[8px] font-mono leading-none mt-0.5",
                                expiryStatus === 'critical' ? "text-red-600 font-bold" : "text-muted-foreground"
                              )}>
                                до {format(parseISO(expiryDate), 'dd.MM.yyyy')}
                              </span>
                            )}
                            {isGroup && (
                              <span className="text-[8px] text-primary/60 font-medium uppercase tracking-tighter mt-0.5">Группа</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-0.5">
                          {isGroup ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className='relative cursor-pointer px-1'>
                                  <Input
                                    value={getGroupTotal(item)}
                                    readOnly
                                    className='h-7 text-center bg-muted/50 font-bold border-primary/20 text-[11px] p-0'
                                  />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className='w-72 sm:w-80 p-2' align="end">
                                {renderGroupDetails(item, 'stock')}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div className='flex items-center gap-0.5 sm:gap-2 justify-center'>
                              <Button
                                variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full"
                                onClick={() => handleStep(item, -1)}
                              >
                                <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </Button>
                              <Input
                                type='number' value={stockOnHand[item] || ''}
                                onChange={e => handleStockChange(item, e.target.value)}
                                className='h-7 w-9 sm:w-12 text-center p-0 text-[11px]' inputMode='numeric'
                              />
                              <Button
                                variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full"
                                onClick={() => handleStep(item, 1)}
                              >
                                <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </Button>
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