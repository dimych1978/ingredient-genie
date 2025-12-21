import { Icons } from '@/components/icons';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-md">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Icons.logo className="h-12 w-12 text-primary" />
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">
              Telemetron
            </h1>
          </div>
          <p className="text-muted-foreground">
            Войдите, чтобы продолжить.
          </p>
        </header>
        {/* <LoginForm /> */}
      </div>
    </main>
  );
}
