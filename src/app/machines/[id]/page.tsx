'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';

export default function MachineStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { getSalesByProducts } = useTeletmetronApi();
  const { token } = useTeletmetronAuth();
  
  useEffect(() => {
    const fetchStatus = async () => {
      // Ждем, пока id и token не будут доступны.
      // Если их нет, ничего не делаем. Эффект перезапустится, когда они появятся.
      if (!id || !token) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const dateFrom = '2025-11-17T00:00:00.000';
        const dateTo = '2025-11-23T23:59:59.999';

        console.log(`Запрос данных о продажах для аппарата #${id}...`);
        const result = await getSalesByProducts(id, dateFrom, dateTo);
        
        console.log('Ответ от API Telemetron:', result);
        setData(result);

      } catch (e) {
        const err = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('Ошибка при загрузке данных:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    
    // Используем только стабильные зависимости: `id` и `token`.
    // `getSalesByProducts` нестабилен и вызывает бесконечный цикл.
  }, [id, token]);

  if (isLoading && (!token || !id)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground transition-opacity duration-300">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold font-headline text-lg">Загрузка данных аппарата...</p>
          <p className="text-sm">Пожалуйста, подождите.</p>
        </div>
      </main>
    );
  }
  
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground transition-opacity duration-300">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold font-headline text-lg">Загрузка данных аппарата...</p>
          <p className="text-sm">Пожалуйста, подождите.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-12">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" aria-label="Вернуться на главную">
                <Icons.logo className="h-10 w-10 text-primary" />
            </Link>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
              Отчет о продажах для аппарата #{id}
            </h1>
          </div>
          <p className="text-muted-foreground">
            JSON Ответ
          </p>
        </header>

        <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">JSON Ответ</CardTitle>
              <CardDescription>Данные о продажах, полученные от сервера.</CardDescription>
            </CardHeader>
            <CardContent>
                {data ? (
                    <pre className="bg-muted/30 p-4 rounded-lg overflow-x-auto text-sm">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                ) : (
                    <p>Нет данных для отображения. Возможно, токен еще не был получен или ID аппарата не указан.</p>
                )}
            </CardContent>
          </Card>
      </div>
    </main>
  );
}
