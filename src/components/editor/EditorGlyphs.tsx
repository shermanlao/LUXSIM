/** LUXSIM-branded toolbar glyphs (not third-party CAD icons). */

export function IconSelect({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4l7 16 2-7 7-2L4 4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDrawRoom({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="7" width="14" height="12" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5" cy="7" r="1.5" fill="currentColor" />
      <circle cx="19" cy="7" r="1.5" fill="currentColor" />
      <circle cx="19" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconCalibrate({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="17" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconRect({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="8" width="12" height="10" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" />
    </svg>
  );
}

export function IconViewTop({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

export function IconView3d({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4L20 9v6l-8 5-8-5V9l8-5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconViewElevation({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 18V8l6-4 6 4v10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 18v-5h6v5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconModeConstruction({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 18V9l8-5 8 5v9H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 18v-4h6v4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconModeLight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v3M8 5l2 2M16 5l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 14h8l-1 6H9l-1-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconModeCalculation({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 12h3M13 12h3M8 16h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconModeExport({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
