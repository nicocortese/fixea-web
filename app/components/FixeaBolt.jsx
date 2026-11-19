export default function FixeaBolt({ className = "h-4 w-4", gradientId = "fixea-bolt-gradient" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      style={{ filter: "drop-shadow(0 0 6px rgba(0, 229, 255, 0.45))" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="12" y1="1.5" x2="12" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="0.5" stopColor="#7000FF" />
          <stop offset="1" stopColor="#FF007F" />
        </linearGradient>
      </defs>
      <path
        d="M13.5 1.5L3.5 14h6.5l-1.5 8.5L19.5 10H13l.5-8.5z"
        fill={`url(#${gradientId})`}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
