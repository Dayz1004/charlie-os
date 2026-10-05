export function TodayView() {
  return (
    <section aria-labelledby="today-heading">
      <p className="mb-3 text-xs font-medium tracking-widest text-muted uppercase">
        Your day, with intention
      </p>
      <h1 id="today-heading" className="text-3xl font-semibold tracking-tight">
        Today
      </h1>
      <p className="mt-3 text-sm text-muted">Make room for what matters.</p>

      <div className="mt-10 rounded-2xl border border-line bg-surface px-8 py-12">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Getting started
        </span>
        <h2 className="mt-6 text-xl font-medium">A clear start.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted">
          Your tasks and upcoming plans will appear here. For now, welcome to your personal
          workspace.
        </p>
      </div>
    </section>
  );
}
