import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { nextPillar } from "@/lib/nav";
export default function ContinueLink({ path }: { path: string }) {
  const next = nextPillar(path);
  return next ? (
    <Link
      href={next.href}
      className="mt-10 flex min-h-16 items-center justify-between rounded-2xl border border-border p-5 text-sm hover:border-primary/40 active:bg-muted md:hidden"
    >
      Next: {next.name}
      <ArrowRight className="h-4 w-4 text-primary" />
    </Link>
  ) : null;
}
