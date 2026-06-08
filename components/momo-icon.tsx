// A momo (Himalayan dumpling) — outline style to match lucide icons.
export function MomoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* dumpling body */}
      <path d="M4 13.5C4 9.4 7.6 6.5 12 6.5s8 2.9 8 7c0 3.6-3.6 5.5-8 5.5s-8-1.9-8-5.5Z" />
      {/* pleated crown — folds fanning from the top pinch */}
      <path d="M12 6.5V3.4" />
      <path d="M12 6.5c-.7-1.6-2.1-2.5-3.7-2.4" />
      <path d="M12 6.5c.7-1.6 2.1-2.5 3.7-2.4" />
      <path d="M12 6.5c-1.4-1-3.2-1.1-4.7-.4" />
      <path d="M12 6.5c1.4-1 3.2-1.1 4.7-.4" />
    </svg>
  )
}
