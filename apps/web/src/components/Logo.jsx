// Logo institucional de Oncología Salta Digital (recorte circular, fondo transparente).
export default function Logo({ size = 44, title = 'Oncología Salta Digital' }) {
  return (
    <img
      className="app-shell__brand-logo"
      src={size > 96 ? '/logo-512.png' : '/favicon-64.png'}
      srcSet={size > 96 ? '/logo-512.png 512w, /logo-oncologia-salta.png 1024w' : '/favicon-64.png 64w, /apple-touch-icon.png 180w'}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={title}
      style={{ width: size, height: size, borderRadius: '50%', boxShadow: '0 1px 4px rgba(18, 49, 44, 0.15)' }}
    />
  );
}
