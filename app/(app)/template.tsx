/** Re-mounts on every top-level navigation so the new section eases in under the fixed header. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
