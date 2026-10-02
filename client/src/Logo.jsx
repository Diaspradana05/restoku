export default function Logo({ size = 28, badge = false }) {
  const icon = (
    <svg width={badge ? size * 0.58 : size} height={badge ? size * 0.58 : size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 8v14a4 4 0 0 0 3 3.87V40a2 2 0 1 0 4 0V25.87A4 4 0 0 0 25 22V8a1.5 1.5 0 0 0-3 0v9a1 1 0 1 1-2 0V8a1.5 1.5 0 0 0-3 0v9a1 1 0 1 1-2 0V8a1.5 1.5 0 0 0-3 0Z" fill="currentColor" />
      <path d="M33 8c-3.3 0-6 3.58-6 8s2.3 7.62 5 7.97V40a1.5 1.5 0 0 0 3 0V8.2c-.63-.13-1.3-.2-2-.2Z" fill="currentColor" />
    </svg>
  );
  if (!badge) return icon;
  return (
    <span className="logo-badge" style={{ width: size, height: size }}>{icon}</span>
  );
}
