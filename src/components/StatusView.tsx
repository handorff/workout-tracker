interface StatusViewProps {
  title: string;
  message: string;
}

export function StatusView({ title, message }: StatusViewProps) {
  return (
    <main className="page-shell justify-center">
      <section className="card space-y-3 p-5">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="text-sm leading-6 text-muted">{message}</p>
      </section>
    </main>
  );
}
