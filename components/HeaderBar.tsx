import Link from "next/link";
import PulseLogo from "./PulseLogo";
import { ThemeToggle } from "./ThemeToggle";

export default function HeaderBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-screen-2xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Predpulse home">
          <PulseLogo size="sm" />
          <span className="text-sm font-semibold tracking-tight">Predpulse</span>
          <span className="rounded border border-primary/20 bg-primary/10 px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wider text-primary">Beta</span>
        </Link>
        <nav className="ml-auto flex items-center gap-3 text-xs text-muted-foreground" aria-label="Main navigation">
          <a href="/#monitor" className="hover:text-foreground">Monitor</a>
          <Link href="/pulse" className="hover:text-foreground">Indices</Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
