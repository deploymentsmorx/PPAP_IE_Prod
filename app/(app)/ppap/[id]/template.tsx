/** Re-mounts on every element switch, so each page eases in while the header and sidebar stay put. */
export default function ElementTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
