"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await signIn("credentials", {
      redirect: false, // Мы сами управляем перенаправлением
      username: username,
      password: password,
    });

    if (result?.error) {
      setError("Неверный логин или пароль. Попробуйте снова.");
    } else if (result?.ok) {
      // Перенаправляем на главную страницу после успешного входа
      router.push("/");
      router.refresh(); // Обновляем страницу, чтобы серверный компонент перерисовался
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <form onSubmit={handleLogin}>
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-4 mb-4">
              <Icons.logo className="h-12 w-12 text-primary" />
              <h1 className="font-headline text-4xl font-bold text-primary">
                Telemetron
              </h1>
            </div>
            <CardTitle className="text-2xl">Вход в систему</CardTitle>
            <CardDescription>
              Введите свой логин и пароль для входа
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Логин</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit">
              Войти
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
