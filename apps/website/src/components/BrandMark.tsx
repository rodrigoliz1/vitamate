type BrandMarkProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  const stroke = inverse ? "#ffffff" : "#2f5233";
  const accent = inverse ? "#e6c7b2" : "#5a7d5e";

  return (
    <span className="brand-lockup" aria-label="VITAMATE">
      <svg className="brand-symbol" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M7 8.5C15 11 21 18 24 35.5C28 20 34 12 42 8" fill="none" stroke={stroke} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 8C11.5 2.5 18 2 22 4.2C20.5 9.4 15.4 11.3 10 8Z" fill={accent} stroke={stroke} strokeWidth="1.7" />
        <path d="M26 7.2C29.2 2.2 36 2.7 39.2 6.3C36.4 10.8 30.7 11.2 26 7.2Z" fill={accent} stroke={stroke} strokeWidth="1.7" />
        <circle cx="24" cy="36.5" r="4.5" fill="#e6c7b2" stroke={stroke} strokeWidth="2" />
      </svg>
      {!compact && (
        <span className="brand-wording">
          <strong>VITAMATE</strong>
          <small>Tu entrenador personal</small>
        </span>
      )}
    </span>
  );
}
