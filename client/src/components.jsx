export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;
  return (
    <div className="pager">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button key={p} className={p === page ? 'on' : ''} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

export const Stars = ({ value = 0, onChange }) => (
  <span className="stars">
    {[1, 2, 3, 4, 5].map((n) => (
      <button type="button" key={n} disabled={!onChange} className={n <= Math.round(value) ? 'on' : ''} onClick={() => onChange?.(n)}>★</button>
    ))}
  </span>
);
