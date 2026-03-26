/**
 * Renders an SVG icon from raw SVG path content.
 * All sidebar/nav icons use the same viewBox and stroke style.
 */
export default function NavIcon({ paths, size = 20, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}
