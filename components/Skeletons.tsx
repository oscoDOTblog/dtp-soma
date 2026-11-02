/** Skeleton placeholders shown while recipes load from MongoDB. */

export function LibrarySkeleton() {
  return (
    <div role="status" aria-label="Loading recipes">
      <ul className="recipe-grid" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="recipe-card">
            <div className="skeleton" style={{ height: "1.6rem", width: "70%" }} />
            <div className="skeleton" style={{ height: "0.95rem", width: "45%" }} />
            <div className="skeleton" style={{ height: "0.95rem", width: "90%" }} />
            <div className="skeleton" style={{ height: "0.95rem", width: "60%" }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading recipe">
      <div aria-hidden="true">
        <div className="skeleton" style={{ height: "2.6rem", width: "min(24rem, 80%)" }} />
        <div className="skeleton" style={{ height: "1rem", width: "min(18rem, 60%)", marginTop: "0.6rem" }} />
        <div className="detail-grid">
          <div className="panel">
            <div className="skeleton" style={{ height: "1.4rem", width: "40%" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.9rem" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.5rem", width: "85%" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.5rem", width: "70%" }} />
          </div>
          <div className="panel">
            <div className="skeleton" style={{ height: "1.4rem", width: "50%" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.9rem" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.5rem" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.5rem", width: "90%" }} />
            <div className="skeleton" style={{ height: "1rem", marginTop: "0.5rem", width: "75%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
