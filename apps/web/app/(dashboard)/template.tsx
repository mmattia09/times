/**
 * Remounts on every route change inside the dashboard, giving each page a
 * subtle entrance animation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">{children}</div>;
}
