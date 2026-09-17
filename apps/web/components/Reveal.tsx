// Keep landing content visible without requiring client hydration or scrolling.
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return <div className="animate-in" style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}
