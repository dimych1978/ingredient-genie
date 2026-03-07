'use client';

import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { MASTER_MACHINE_IDS, planogramsHardCode } from '@/lib/data';
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
import { Loader2, Search, RefreshCcw, X } from 'lucide-react';
import { format } from 'date-fns';
import type { TelemetronSaleItem } from '@/types/telemetron';

export const InventoryManager = () => {
  const { stockOnHand, setStockOnHand } = useScheduleState();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

        const allProductNames = new Set<string>();

        // Добавляем захардкоженные бутылочные товары
        planogramsHardCode.bottle.forEach(item => allProductNames.add(item));

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
                if (sale.planogram?.name) {
                  // Извлекаем название товара без номера ячейки
                  const match = sale.planogram.name.match(
                    /^\d+[A-Za-z]?\.\s*(.+)$/,
                  );
                  const cleanName = match ? match[1] : sale.planogram.name;
                  if (cleanName && cleanName !== 'пр') {
                    allProductNames.add(cleanName);
                  }
                }
              });
            }
          } catch (e) {
            console.error(`Ошибка загрузки каталога для ${id}:`, e);
          }
        });

        await Promise.all(promises);
        const sortedCatalog = Array.from(allProductNames).sort((a, b) =>
          a.localeCompare(b, 'ru'),
        );

        setCatalog(sortedCatalog);
        localStorage.setItem('master_catalog', JSON.stringify(sortedCatalog));
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

  const filteredCatalog = useMemo(() => {
    return catalog.filter(item =>
      item.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [catalog, searchQuery]);

  const handleStockChange = (itemName: string, value: string) => {
    if (/^\d{0,2}$/.test(value)) {
      setStockOnHand(prev => ({ ...prev, [itemName]: value }));
    }
  };

  return (
    <div className='space-y-4'>
      <Card className='relative'>
        <CardHeader className='pb-3 sticky top-0 z-20 bg-background/95 backdrop-blur border-b'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Склад / Остатки в руках</CardTitle>
              <CardDescription>
                Редактируйте количество товара, которое у вас с собой. Изменения
                сразу попадут в заявку.
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
          <div className='relative mt-4'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Поиск по каталогу...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-9 h-9'
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                <X className='w-4 h-4' />
              </button>
            )}
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
                  {filteredCatalog.map(item => (
                    <TableRow key={item}>
                      <TableCell className='text-sm font-medium'>
                        {item}
                      </TableCell>
                      <TableCell>
                        <Input
                          type='number'
                          value={stockOnHand[item] || ''}
                          onChange={e =>
                            handleStockChange(item, e.target.value)
                          }
                          placeholder='0'
                          className='h-8 text-center'
                          inputMode='numeric'
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className='text-center py-10 text-muted-foreground'
                      >
                        {searchQuery
                          ? 'Товары не найдены'
                          : 'Каталог пуст. Нажмите кнопку обновления.'}
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
