interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function KnittingIcon({ size = 40, color = "currentColor", className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Ball of yarn */}
      <circle cx="14" cy="26" r="9" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Yarn contour lines */}
      <path d="M6 22 Q14 18 22 22" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M5.5 26 Q14 30 22.5 26" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M8 30.5 Q14 28 20 30.5" stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M9 18 Q14 20 19 18" stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* Needle 1 — going upper-right, tip at top */}
      <line x1="18" y1="22" x2="33" y2="5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      {/* Needle 1 tip */}
      <circle cx="33.5" cy="4.5" r="1.4" fill={color} />
      {/* Needle 1 butt cap */}
      <rect x="16.5" y="23" width="3" height="4.5" rx="1.5" transform="rotate(-47 18 22)" stroke={color} strokeWidth="1.2" fill="none" />

      {/* Needle 2 — parallel, slightly offset */}
      <line x1="21" y1="19.5" x2="36" y2="2.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      {/* Needle 2 tip */}
      <circle cx="36.5" cy="2" r="1.4" fill={color} />
      {/* Needle 2 butt cap */}
      <rect x="19.5" y="20.5" width="3" height="4.5" rx="1.5" transform="rotate(-47 21 19.5)" stroke={color} strokeWidth="1.2" fill="none" />

      {/* Yarn strand from ball to needle */}
      <path d="M21 19 Q19 16 18 12 Q17.5 8 19 5" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  );
}

export function BoltIcon({ size = 40, color = "currentColor", className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Circuit board trace background */}
      <path
        d="M8 20 H13 V12 H20"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path
        d="M20 28 H27 V32 H32"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <circle cx="8" cy="20" r="1.5" fill={color} opacity="0.35" />
      <circle cx="32" cy="32" r="1.5" fill={color} opacity="0.35" />

      {/* Lightning bolt */}
      <path
        d="M23 4 L12 22 H19.5 L17 36 L29 17 H22 L23 4Z"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function getProfileIcon(iconKey: string, size: number, color: string) {
  switch (iconKey) {
    case "knitting":
      return <KnittingIcon size={size} color={color} />;
    case "bolt":
    default:
      return <BoltIcon size={size} color={color} />;
  }
}
