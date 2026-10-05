// Marca de Onco-Salta: dos cintas entrelazadas (verde y turquesa) que remiten
// al lazo oncológico sin copiar ningún logo existente.
export default function Logo({ size = 44, title = 'Onco-Salta Digital' }) {
  return (
    <svg className="app-shell__brand-logo" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title}>
      <path d="M24 6c8 0 14 6.5 14 14.5S31 36 24 42" fill="none" stroke="#2f8f6b" strokeWidth="6" strokeLinecap="round" />
      <path d="M24 42c-8 0-14-6.5-14-14.5S17 12 24 6" fill="none" stroke="#2b7d8c" strokeWidth="6" strokeLinecap="round" />
      <circle cx="24" cy="24" r="4.5" fill="#8fd1b6" />
    </svg>
  );
}
