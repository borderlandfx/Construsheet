export default function ProjectLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--cs-border)", borderTopColor: "var(--cs-accent)" }}
        />
        <p className="text-sm" style={{ color: "var(--cs-muted)" }}>
          Cargando proyecto...
        </p>
      </div>
    </div>
  );
}
