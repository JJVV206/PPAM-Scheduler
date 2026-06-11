"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isDatabaseConnectionError(message: string) {
  return (
    message.includes("Can't reach database server") ||
    message.includes("DATABASE_URL") ||
    message.includes("PrismaClientInitializationError")
  );
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const databaseDown = isDatabaseConnectionError(error.message);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
      <div className="surface-panel w-full max-w-2xl space-y-5 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">
          PPAM Planificador
        </p>
        <h1 className="font-heading text-3xl font-semibold">
          {databaseDown ? "Base de datos no disponible" : "Algo salió mal"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {databaseDown
            ? "La app está corriendo, pero PostgreSQL no está disponible en localhost:5432."
            : "Ocurrió un error inesperado al cargar esta página."}
        </p>

        {databaseDown ? (
          <div className="rounded-3xl border border-border/70 bg-white/[0.03] p-5 text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Recuperación local</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Inicia Docker Desktop.</li>
              <li>Ejecuta <code>npm run db:start</code>.</li>
              <li>Ejecuta <code>npm run db:push</code> si es el primer arranque.</li>
              <li>Ejecuta <code>npm run db:seed</code> si necesitas datos de prueba.</li>
              <li>Vuelve aquí y presiona reintentar.</li>
            </ol>
          </div>
        ) : null}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => reset()}>Reintentar</Button>
          <Button variant="secondary" asChild>
            <Link href="/login">Volver al acceso</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
