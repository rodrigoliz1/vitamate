export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark${compact ? ' brand-mark--compact' : ''}`} aria-label="VITAMATE">
      <span className="brand-symbol" aria-hidden="true"><i /><b>V</b><i /></span>
      <span><strong>VITAMATE</strong>{!compact && <small>Tu entrenador personal</small>}</span>
    </div>
  );
}
