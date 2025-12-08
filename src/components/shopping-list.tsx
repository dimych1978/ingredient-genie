
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { calculateShoppingList, type ShoppingListItem } from '@/lib/shopping-calculator';
import type { TelemetronSalesResponse, TelemetronSaleItem } from '@/types/telemetron';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShoppingCart, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ShoppingListProps {
  machineIds: string[];
  title?: string;
  description?: string;
  showControls?: boolean;
  forceLoad?: boolean;
  specialMachineDates?: Record<string, string>;
  onDateChange?: (date: string) => void;
}

export const ShoppingList = ({ 
  machineIds: initialMachineIds,
  title = "Shopping List",
  description,
  showControls = true,
  forceLoad = false,
  specialMachineDates = {},
  onDateChange
}: ShoppingListProps) => {
  const [loading, setLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const machineDate = specialMachineDates[initialMachineIds[0]];
    if (machineDate) {
      return new Date(machineDate);
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  
  const [machineIds, setMachineIds] = useState<string[]>(initialMachineIds);
  const machineIdsString = useMemo(() => machineIds.join(', '), [machineIds]);
  
  const { getSalesByProducts, getMachineOverview } = useTeletmetronApi();
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
    if (onDateChange) {
      onDateChange(newDate.toISOString());
    }
  };

  const handleMachineIdsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ids = e.target.value.split(',').map(id => id.trim()).filter(Boolean);
    setMachineIds(ids);
  };
  
  const loadShoppingList = useCallback(async () => {
    if (machineIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не указаны ID аппаратов.',
      });
      return;
    }
    setLoading(true);
    setShoppingList([]);
    
    try {
      const allSales: TelemetronSaleItem[] = [];
      const dateTo = format(new Date(), "yyyy-MM-dd'T'23:59:59.999");

      for (const vmId of machineIds) {
          try {
              let startDate: Date;
              
              if (specialMachineDates[vmId]) {
                  startDate = new Date(specialMachineDates[vmId]);
              } else {
                  const machineOverview = await getMachineOverview(vmId);
                  const lastCollection = machineOverview?.data?.cache?.last_collection_at;
                  if (lastCollection) {
                      startDate = new Date(lastCollection);
                  } else {
                      startDate = dateFrom;
                  }
              }
              
              const dateFromStr = format(startDate, "yyyy-MM-dd'T'00:00:00.000");
              
              console.log(`[ShoppingList] Расчет для аппарата #${vmId}. Период: с ${dateFromStr} по ${dateTo}`);

              const salesData: TelemetronSalesResponse = await getSalesByProducts(vmId, dateFromStr, dateTo);
              if (salesData && salesData.data) {
                  allSales.push(...salesData.data);
              }
          } catch(e) {
              console.error(`Ошибка загрузки продаж для аппарата ${vmId}:`, e);
              toast({
                  variant: 'destructive',
                  title: `Ошибка для аппарата ${vmId}`,
                  description: e instanceof Error ? e.message : 'Не удалось загрузить данные.',
              });
          }
      }
      
      const combinedSalesData = { data: allSales };
      const list = calculateShoppingList(combinedSalesData);
      setShoppingList(list);
      
      if(list.length === 0 && allSales.length > 0){
        toast({
            variant: 'default',
            title: 'Список пуст',
            description: 'За выбранный период продаж не найдено, но данные были получены.',
        });
      }
      
    } catch (error) {
      console.error('Ошибка загрузки shopping list:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось сформировать список.',
      });
    } finally {
      setLoading(false);
    }
  }, [machineIds, getSalesByProducts, getMachineOverview, toast, dateFrom, specialMachineDates]);

  useEffect(() => {
    if (forceLoad) {
      loadShoppingList();
    }
  }, [forceLoad, machineIdsString, dateFrom, loadShoppingList]);

  const downloadList = () => {
    const periodStr = `${format(dateFrom, 'dd.MM.yyyy')}-Today`;
    const header = `${title}\nПериод: ${periodStr}\nАппараты: ${machineIdsString}\n\n`;
    
    const itemsText = shoppingList.map((item, index) => 
      `${index + 1}. ${item.name}: ${item.amount} ${item.unit}`
    ).join('\n');
    
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

  const formatDate = (date: Date) => {
    return format(date, 'dd.MM.yyyy', { locale: ru });
  };

  return (
    <Card className="w-full bg-gray-900 border-gray-700 text-white">
      <CardHeader className="border-b border-gray-700">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-yellow-400" />
            {title}
          </div>
          {shoppingList.length > 0 && (
            <div className="text-sm font-normal text-gray-300">
              {shoppingList.length} позиций
            </div>
          )}
        </CardTitle>
        {description && <p className="text-gray-400 text-sm pt-2">{description}</p>}
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {showControls && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-800 rounded-lg">
              {machineIds.length > 1 &&
                <div className="md:col-span-2">
                    <Label htmlFor="vmIds" className="block text-sm text-gray-400 mb-1">ID аппаратов (через запятую)</Label>
                    <Input
                    id="vmIds"
                    value={machineIdsString}
                    onChange={handleMachineIdsChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="58690, 40680"
                    />
                </div>
              }
              
              <div className="md:col-span-2">
                <Label htmlFor="dateFrom" className="block text-sm text-gray-400 mb-1">Дата начала периода</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <Input
                    id="dateFrom"
                    type="date"
                    value={format(dateFrom, 'yyyy-MM-dd')}
                    onChange={handleDateChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
              </div>
              
              <div className="md:col-span-2">
                 <p className="text-sm text-gray-400">
                  Дата "По" всегда устанавливается на сегодня. Для спец. аппаратов дата будет взята из их индивидуальных настроек.
                 </p>
              </div>

            </div>

            <Button
              onClick={loadShoppingList}
              disabled={loading}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-700 w-full"
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              {loading ? 'Загружаем...' : 'Создать Shopping List'}
            </Button>
          </>
        )}

        {shoppingList.length > 0 && (
          <div className="flex gap-3">
             <Button
                onClick={downloadList}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 flex-1"
                disabled={loading}
              >
                <Download className="mr-2 h-4 w-4" />
                Скачать список
              </Button>
          </div>
        )}
        
        {shoppingList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
              <div className="font-medium">
                Что брать с собой к аппаратам:
              </div>
              <div className="text-sm text-gray-400">
                {/* Period display can be tricky with individual dates */}
              </div>
            </div>
            
            <div className="grid gap-2">
              {shoppingList.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded">
                      <span className="text-sm font-bold text-yellow-400">{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-400">Единица: {item.unit}</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-green-400">
                    {item.amount.toLocaleString('ru-RU')} {item.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin h-8 w-8 text-yellow-400 mx-auto mb-3" />
            <div className="text-gray-400">Загружаем данные и формируем список...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
