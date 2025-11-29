// components/token-debug.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TokenDebug = () => {
  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const { getToken, getTokenInfo, token } = useTeletmetronAuth();
  const { toast } = useToast();

  const checkToken = async () => {
    setLoading(true);
    try {
      console.log('🔍 Проверка токена...');
      
      const currentToken = await getToken();
      const info = getTokenInfo();
      
      setTokenInfo({
        token: currentToken ? `${currentToken.substring(0, 50)}...` : 'No token',
        tokenLength: currentToken?.length,
        info: info,
        rawToken: currentToken // Только для отладки, не показывать в UI
      });

      console.log('🔑 Токен информация:', info);
      
      if (info.token) {
        toast({
          title: 'Токен найден!',
          description: `Токен действителен, истекает через ${info.timeUntilExpiry}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Токен не найден',
          description: 'Не удалось получить токен',
        });
      }

    } catch (error) {
      console.error('❌ Ошибка проверки токена:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось проверить токен',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Отладка токена
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={checkToken} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          {loading ? 'Проверка...' : 'Проверить токен'}
        </Button>

        {tokenInfo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-blue-600">
                    {tokenInfo.info.isValid ? '✅ Valid' : '❌ Invalid'}
                  </div>
                  <div className="text-gray-600">Статус</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-green-600">
                    {tokenInfo.tokenLength || 0}
                  </div>
                  <div className="text-gray-600">Длина токена</div>
                </CardContent>
              </Card>
            </div>

            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Токен:</span>
                <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                  {tokenInfo.token}
                </div>
              </div>
              <div>
                <span className="font-medium">Истекает:</span>
                <div>{tokenInfo.info.expiry ? tokenInfo.info.expiry.toLocaleString('ru-RU') : 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium">Время до истечения:</span>
                <div>{tokenInfo.info.timeUntilExpiry || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 p-3 bg-yellow-50 rounded">
          <div className="font-medium mb-1">Проблема может быть в:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Токен не генерируется</li>
            <li>Токен не передается в заголовках</li>
            <li>Токен истек</li>
            <li>Проблемы с аутентификацией</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};