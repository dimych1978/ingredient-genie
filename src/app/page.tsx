
import { Icons } from '@/components/icons';
import { MachineSearch } from '@/components/machine-search';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarCheck } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-2xl">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Icons.logo className="h-12 w-12 text-primary" />
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">
              Telemetron
            </h1>
          </div>
          <p className="text-muted-foreground">
            Панель управления вендинговыми аппаратами.
          </p>
        </header>

        <Card className="w-full">
            <CardHeader>
                <CardTitle>Быстрый доступ к аппарату</CardTitle>
                <CardDescription>Найдите аппарат по названию или локации для просмотра детальной информации и создания списка загрузки.</CardDescription>
            </CardHeader>
            <CardContent>
                <MachineSearch />
            </CardContent>
            <Separator className="my-4" />
            <CardContent className="flex flex-col items-center">
                <p className="text-sm text-muted-foreground mb-4">Или перейдите к формированию заявки на день</p>
                 <Button asChild className="w-full md:w-auto">
                    <Link href="/schedule">
                        <CalendarCheck className="mr-2 h-4 w-4" />
                        Заявка на день
                    </Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
