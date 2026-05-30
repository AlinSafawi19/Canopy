export function LogoMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 18"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Upper arc — wide canopy layer */}
      <path
        d="M1 13 Q10 1 19 13"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Lower arc — inner canopy layer */}
      <path
        d="M5 17 Q10 8 15 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
