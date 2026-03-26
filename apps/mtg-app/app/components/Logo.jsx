/**
 * MtgBroker logo — uses the actual brand logo image from /logo.png.
 * All sizing done via inline styles to override Tailwind v4 base reset.
 * The logo PNG is 3471x552 (6.29:1 ratio).
 */
export default function Logo({ height = 28, inverted = false }) {
  const w = Math.round(height * 6.29);
  return (
    <img
      src="/logo.png"
      alt="MtgBroker"
      width={w}
      height={height}
      style={{
        height: `${height}px`,
        width: `${w}px`,
        maxWidth: "none",
        display: "block",
        objectFit: "contain",
        ...(inverted ? { filter: "brightness(0) invert(1)" } : {}),
      }}
    />
  );
}
