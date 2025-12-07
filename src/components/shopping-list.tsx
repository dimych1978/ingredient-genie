'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { calculateShoppingList, type ShoppingListItem } from '@/lib/shopping-calculator';
import type { TelemetronSalesResponse } from '@/types/telemetron';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ShoppingCart, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ShoppingListProps {
  machineId?: string;
  defaultPeriod?: { from: Date; to: Date };
}

export const ShoppingList = ({ machineId, defaultPeriod }: ShoppingListProps) => {
  const [loading, setLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [period, setPeriod] = useState<{ from: Date; to: Date }>(
    defaultPeriod || {
      from: new Date(new Date().setDate(new Date().getDate() - 7)),
      to: new Date()
    }
  );
  const [vmId, setVmId] = useState<string>(machineId || '');
  const { getSalesByProducts } = useTeletmetronApi();

  const loadShoppingList = async () => {
    if (!vmId) return;
    
    setLoading(true);
    setShoppingList([]);
    
    try {
      const dateFrom = format(period.from, "yyyy-MM-dd'T'00:00:00.000");
      const dateTo = format(period.to, "yyyy-MM-dd'T'23:59:59.999");
      
      const salesData: TelemetronSalesResponse = await getSalesByProducts(vmId, dateFrom, dateTo);
      
      const list = calculateShoppingList(salesData);
      setShoppingList(list);
      
    } catch (error) {
      console.error('Ошибка загрузки shopping list:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadList = () => {
    const periodStr = `${format(period.from, 'dd.MM.yyyy')}-${format(period.to, 'dd.MM.yyyy')}`;
    const header = `Shopping List для аппарата ${vmId}\nПериод: ${periodStr}\n\n`;
    
    const itemsText = shoppingList.map((item, index) => 
      `${index + 1}. ${item.name}: ${item.amount} ${item.unit}`
    ).join('\n');
    
    const text = header + itemsText;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-list-${vmId}-${periodStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (date: Date) => {
    return format(date, 'dd.MM.yyyy', { locale: ru });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Shopping List
        </CardTitle>
        <CardDescription>
          Создайте список ингредиентов для загрузки аппарата
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Параметры */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">ID аппарата</label>
            <Input
              value={vmId}
              onChange={(e) => setVmId(e.target.value)}
              placeholder="58690"
              disabled={!!machineId}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">С</label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={format(period.from, 'yyyy-MM-dd')}
                onChange={(e) => setPeriod(prev => ({ ...prev, from: new Date(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">По</label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={format(period.to, 'yyyy-MM-dd')}
                onChange={(e) => setPeriod(prev => ({ ...prev, to: new Date(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3">
          <Button
            onClick={loadShoppingList}
            disabled={loading || !vmId}
            className="flex-1"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
            {loading ? 'Загружаем...' : 'Создать Shopping List'}
          </Button>
          
          {shoppingList.length > 0 && (
            <Button
              onClick={downloadList}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Скачать
            </Button>
          )}
        </div>

        {/* Shopping List */}
        {shoppingList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <div className="font-medium">
                Что брать с собой к аппарату {vmId}:
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(period.from)} - {formatDate(period.to)}
              </div>
            </div>
            
            <div className="grid gap-2">
              {shoppingList.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded">
                      <span className="text-sm font-bold text-primary">{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">Единица: {item.unit}</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {item.amount.toLocaleString('ru-RU')} {item.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && shoppingList.length === 0 && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto mb-3" />
            <div className="text-muted-foreground">Загружаем данные о продажах...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};