//schedule.page.tsx
import { Icons } from '@/components/icons';
import { TomorrowsMachines } from '@/components/tomorrows-machines';
import Link from 'next/link';

export default function SchedulePage() {
  return (
    <main className="min-h-screen py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <Link href="/" className="flex items-center gap-4 mb-4 w-fit">
          <Icons.logo className="h-12 w-12 text-primary" />
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">
            Telemetron
          </h1>
        </Link>
        <p className="text-muted-foreground max-w-2xl">
          Планирование обслуживания и формирование заказов на выбранную дату.
        </p>
      </header>

      <div className="space-y-8">
        <TomorrowsMachines />
      </div>
    </main>
  );
}
