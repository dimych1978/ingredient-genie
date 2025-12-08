
import { Icons } from '@/components/icons';
import { TomorrowsMachines } from '@/components/tomorrows-machines';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-12">
          <div className="flex justify-center md:justify-start items-center gap-4 mb-4">
            <Icons.logo className="h-12 w-12 text-primary" />
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">
              Telemetron
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto md:mx-0 text-center md:text-left">
            Панель управления вендинговыми аппаратами.
          </p>
        </header>

        <div className="grid gap-8">
          <div className="lg:col-span-3 space-y-8">
            <TomorrowsMachines />
          </div>
        </div>
      </div>
    </main>
  );
}
