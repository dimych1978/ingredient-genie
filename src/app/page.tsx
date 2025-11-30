// app/page.tsx
import { TokenDebug } from '@/components/token-debug';
import { SimpleProxyTest } from '@/components/simple-proxy-test';
import { CorsTest } from '@/components/cors-test';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BasicTest } from '@/components/basic-test';
import { WorkingApisTest } from '@/components/working-apis-test';
import { AccessTest } from '@/components/access-test';
import { ExtendedAccessTest } from '@/components/extended-access-test';
import { ModemVmConnection } from '@/components/modem-vm-connection';
import { RefillCollectionViewer } from '@/components/refill-collection-viewer';
import { SimpleRefillTest } from '@/components/simple-refill-test';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Icons.logo className="h-12 w-12 text-primary" />
            <h1 className="text-3xl font-bold">Debug Dashboard</h1>
          </div>
        </header>

        <Tabs defaultValue="token" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="token">Токен</TabsTrigger>
            <TabsTrigger value="proxy">Прокси</TabsTrigger>
            <TabsTrigger value="cors">Эндпоинты</TabsTrigger>
          </TabsList>

          <TabsContent value="token">
            <TokenDebug />
            <ModemVmConnection />
            <ExtendedAccessTest />
          </TabsContent>

          <TabsContent value="proxy">
            <SimpleProxyTest />
          </TabsContent>

          <TabsContent value="cors">
            <CorsTest />
            <RefillCollectionViewer />
            <SimpleRefillTest />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}