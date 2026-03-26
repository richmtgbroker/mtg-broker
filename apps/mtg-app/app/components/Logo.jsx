/**
 * MtgBroker logo rendered as inline SVG text.
 * This eliminates all img path, CSS override, and loading issues.
 * Uses the brand font (Host Grotesk) with the blue dot accent.
 */
export default function Logo({ height = 28, inverted = false }) {
  const textColor = inverted ? "#ffffff" : "#0f172a";
  const dotColor = "#1a56db";
  // Aspect ratio: roughly 6.3:1 based on the original logo proportions
  const width = Math.round(height * 6.3);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 189 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MtgBroker"
      role="img"
    >
      <text
        x="0"
        y="24"
        fontFamily="'Host Grotesk', system-ui, -apple-system, sans-serif"
        fontSize="26"
        fontWeight="800"
        letterSpacing="-0.5"
        fill={textColor}
      >
        mtg
      </text>
      <text
        x="54"
        y="24"
        fontFamily="'Host Grotesk', system-ui, -apple-system, sans-serif"
        fontSize="26"
        fontWeight="800"
        letterSpacing="-0.5"
        fill={dotColor}
      >
        .
      </text>
      <text
        x="62"
        y="24"
        fontFamily="'Host Grotesk', system-ui, -apple-system, sans-serif"
        fontSize="26"
        fontWeight="800"
        letterSpacing="-0.5"
        fill={textColor}
      >
        broker
      </text>
    </svg>
  );
}
