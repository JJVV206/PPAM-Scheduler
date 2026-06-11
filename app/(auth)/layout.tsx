export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-dashboard-radial" />
      <div className="pointer-events-none absolute inset-y-0 left-[-18rem] w-[34rem] rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="hidden max-w-xl space-y-6 lg:block">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.32em] text-primary/80">
              PPAM Planificador
            </p>
            <h1 className="font-heading text-5xl font-semibold leading-tight text-balance">
              Horarios semanales, confirmaciones y reemplazos en un solo centro de control.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-muted-foreground">
              Coordina el punto de predicación, detecta vacantes a tiempo y mantén a los voluntarios avanzando con un flujo de confirmación más claro.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Administración
              </p>
              <p className="mt-3 font-heading text-2xl font-semibold">Control operativo del horario</p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Voluntariado
              </p>
              <p className="mt-3 font-heading text-2xl font-semibold">Confirmación móvil ágil</p>
            </div>
          </div>
        </div>
        <div className="flex w-full justify-center lg:justify-end">{children}</div>
      </div>
    </div>
  );
}
