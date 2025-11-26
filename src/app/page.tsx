
import Link from 'next/link';
import { TeletmetronUpload } from '@/components/telemetron-upload';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import { allMachines } from '@/lib/data';

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

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-2xl">Список аппаратов</CardTitle>
                <CardDescription>
                  Просмотр состояния и управление вашими аппаратами.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Местоположение</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMachines.map((machine) => (
                      <TableRow key={machine.id}>
                        <TableCell className="font-mono">#{machine.id}</TableCell>
                        <TableCell className="font-medium">{machine.name}</TableCell>
                        <TableCell className="text-muted-foreground">{machine.location}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/machines/${machine.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Посмотреть</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-1">
             <TeletmetronUpload />
          </div>
        </div>
      </div>
    </main>
  );
}
