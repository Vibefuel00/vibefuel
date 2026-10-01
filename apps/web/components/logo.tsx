/** Orange fuel pump mark (no bolt). Scales with the `size` prop or CSS. */
export function FuelPumpMark({ className = "logo-mark", size = 22 }: { className?: string; size?: number | string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 22 22"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="1.5" width="11" height="19" rx="2" fill="currentColor" />
      <rect x="4.25" y="4" width="6.5" height="5" rx="1" fill="#f4ebe3" />
      <rect x="0.5" y="19" width="14" height="2.5" rx="1" fill="currentColor" />
      <path
        d="M15 5.5h1.5a1.5 1.5 0 0 1 1.5 1.5v8.75a1.25 1.25 0 0 0 2.5 0V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M19.6 5.2l1.4 1.9v2.4h-2.8V7.1z" fill="currentColor" />
    </svg>
  )
}
