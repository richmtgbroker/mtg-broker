/**
 * MtgBroker logo — uses the actual brand logo image from /logo.png.
 * Uses inline styles with explicit dimensions to prevent Tailwind v4
 * base reset (img { height: auto }) from overriding the size.
 *
 * Props:
 *   height — logo height in px (default 28)
 *   inverted — if true, applies brightness/invert filter for dark backgrounds
 */
export default function Logo({ height = 28, inverted = false }) {
  return (
    <img
      src="/logo.png"
      alt="MtgBroker"
      width={Math.round(height * 6.3)}
      height={height}
      style={{
        height: height + "px",
        width: "auto",
        display: "block",
        ...(inverted ? { filter: "brightness(0) invert(1)" } : {}),
      }}
    />
  );
}
