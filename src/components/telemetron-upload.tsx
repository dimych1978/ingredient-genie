// components/teletmetron-upload.tsx
"use client";

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TeletmetronUpload: React.FC = () => {
  const [vmId, setVmId] = useState('40680'); // Default to 40680 as requested
  const [loading, setLoading] = useState(false);
  const { getSalesByProducts } = useTeletmetronApi();
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!vmId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Введите ID аппарата.',
      });
      return;
    }

    setLoading(true);
    try {
      // These dates seem to be in the future, using them as you provided.
      const salesData = await getSalesByProducts(
        vmId,
        '2025-11-17T00:00:00.000',
        '2025-11-23T23:59:59.999'
      );
      
      console.log('Sales data from API:', salesData);
      
      toast({
        title: 'Данные загружены',
        description: `Данные о продажах для аппарата #${vmId} выведены в консоль браузера.`,
      });
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
      toast({
        variant: 'destructive',
        title: 'Ошибка при загрузке данных',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-2xl">Загрузка данных</CardTitle>
            <CardDescription>Загрузка данных о продажах из Telemetron.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="vmId">ID аппарата:</Label>
                    <Input
                        id="vmId"
                        type="text"
                        placeholder="Например: 40680"
                        value={vmId}
                        onChange={(e) => setVmId(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <Button 
                    onClick={handleUpload} 
                    disabled={loading || !vmId.trim()}
                    className="w-full"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Download />}
                    {loading ? 'Загрузка...' : 'Загрузить и вывести в консоль'}
                </Button>
            </div>
        </CardContent>
    </Card>
  );
};
