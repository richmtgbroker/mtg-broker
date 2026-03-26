/**
 * MtgBroker logo — loaded from Webflow CDN (same source as the live site).
 * Uses inline styles with explicit dimensions and maxWidth:none to override
 * Tailwind v4 base reset. The PNG is 3471x552 (6.29:1 ratio).
 */
const LOGO_URL = "https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png";

export default function Logo({ height = 28, inverted = false }) {
  const w = Math.round(height * 6.29);
  return (
    <img
      src={LOGO_URL}
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
