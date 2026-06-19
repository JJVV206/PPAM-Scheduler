const statSkeletons = Array.from({ length: 4 }, (_, index) => index);
const rowSkeletons = Array.from({ length: 5 }, (_, index) => index);

export function RouteLoading() {
  return (
    <div aria-label="Cargando página" className="space-y-4" role="status">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statSkeletons.map((item) => (
          <div
            key={item}
            className="surface-elevated min-h-[112px] animate-pulse p-4"
          >
            <div className="mb-4 h-3 w-28 rounded-full bg-secondary" />
            <div className="h-8 w-16 rounded-md bg-secondary/80" />
          </div>
        ))}
      </section>

      <section className="surface-panel min-h-[320px] animate-pulse p-4">
        <div className="mb-6 h-5 w-48 rounded-full bg-secondary" />
        <div className="space-y-3">
          {rowSkeletons.map((item) => (
            <div
              key={item}
              className="h-14 rounded-lg border border-border/60 bg-background/35"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
