'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';
import { handleLogin } from '@/app/actions';

const formSchema = z.object({
  email: z.string().email('Неверный формат email.'),
  password: z.string().min(1, 'Пароль не может быть пустым.'),
});

type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      const result = await handleLogin(data);
      if (result.success) {
        toast({
          title: 'Вход выполнен',
          description: 'Вы успешно вошли в систему.',
        });
        router.push('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка входа',
          description: result.error || 'Неверный email или пароль.',
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Произошла неизвестная ошибка.';
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Вход</CardTitle>
        <CardDescription>Введите ваши учетные данные.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !form.formState.isValid}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
            Войти
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
