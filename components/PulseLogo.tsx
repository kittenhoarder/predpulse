interface PulseLogoProps {
  /** sm = 20px wide (nav), md = 28px wide (headings) */
  size?: "sm" | "md";
  className?: string;
}

/**
 * ECG-style pulse-wave SVG mark — the Predpulse brand logo.
 * Flatlines, spikes, flatlines: immediately readable as a "pulse" at any size.
 */
export default function PulseLogo({ size = "sm", className = "" }: PulseLogoProps) {
  const dim = size === "md" ? 28 : 20;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-primary shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polyline points="2,20 10,20 15,6 20,34 25,20 30,20 33,12 36,26 40,20" />
    </svg>
  );
}
