import { MachineForm } from '@/components/machine-form';
import { Icons } from '@/components/icons';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-8 md:mb-12">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Icons.logo className="h-12 w-12 text-primary" />
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">
              Telemetron Sales App
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Easily generate ingredient order lists for your production machines. Input your machine types and quantities,
            and let our AI assistant create a detailed order for you.
          </p>
        </header>

        <MachineForm />
      </div>
    </main>
  );
}
