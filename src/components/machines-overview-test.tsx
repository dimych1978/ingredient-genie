// components/machines-overview-test.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';

export const MachinesOverviewTest = () => {
  const [vmId, setVmId] = useState('51211');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  const { token, getToken } = useTeletmetronAuth();

  const testMachinesOverview = async () => {
    setLoading(true);
    setResult(null);

    try {
      const currentToken = token || await getToken();
      if (!currentToken) throw new Error('Токен не найден');

      const formData = new FormData();
      formData.append('_method', 'get');
      formData.append('data[id]', vmId);

      // ИСПРАВЛЕНО: убрали /telemetron
      const response = await fetch('/api/machines-overview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult({ success: true, data });
      
      toast({
        title: 'Успех!',
        description: `Данные аппарата #${vmId} получены`,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setResult({ success: false, error: errorMsg });
      
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: `Ошибка: ${errorMsg}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Тестирование machines-overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={vmId}
          onChange={(e) => setVmId(e.target.value)}
          placeholder="ID аппарата"
        />

        <Button onClick={testMachinesOverview} disabled={loading} className="w-full">
          {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
          {loading ? 'Тестируем...' : 'Тестировать'}
        </Button>

        {result && (
          <div className="space-y-2">
            <div className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.success ? '✅ Успех' : '❌ Ошибка'}
            </div>
            <pre className="text-xs border p-2 rounded overflow-x-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};