const statSkeletons = Array.from({ length: 4 }, (_, index) => index);
const rowSkeletons = Array.from({ length: 5 }, (_, index) => index);

export function RouteLoading() {
  return (
    <div
      aria-label="Cargando página"
      className="space-y-6"
      role="status"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statSkeletons.map((item) => (
          <div
            key={item}
            className="surface-elevated min-h-[132px] animate-pulse p-5 xl:p-6"
          >
            <div className="mb-5 h-3 w-28 rounded-full bg-white/10" />
            <div className="h-9 w-16 rounded-xl bg-white/12" />
          </div>
        ))}
      </section>

      <section className="surface-panel min-h-[360px] animate-pulse p-5 sm:p-6">
        <div className="mb-8 h-6 w-48 rounded-full bg-white/12" />
        <div className="space-y-4">
          {rowSkeletons.map((item) => (
            <div
              key={item}
              className="h-16 rounded-2xl border border-white/5 bg-white/[0.04]"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
