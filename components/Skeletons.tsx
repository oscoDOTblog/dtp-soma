/** Spinning-wheel placeholders shown while recipes load from MongoDB. */

function Spinner({ label }: { label: string }) {
  return (
    <div className="loader" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function LibrarySkeleton() {
  return <Spinner label="Loading recipes…" />;
}

export function DetailSkeleton() {
  return <Spinner label="Loading recipe…" />;
}
