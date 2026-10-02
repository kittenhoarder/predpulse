import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Grid2X2,
  Newspaper,
  Scale,
  Star,
  Sun,
  ChartNoAxesCombined,
  ArrowLeftRight,
} from "lucide-react";
const icons = {
  today: Sun,
  moves: ArrowUpRight,
  outlooks: CalendarDays,
  indices: Activity,
  markets: Grid2X2,
  newsroom: Newspaper,
  policy: Scale,
  attention: ChartNoAxesCombined,
  compare: ArrowLeftRight,
  saved: Star,
};
export default function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const Icon = icons[name as keyof typeof icons] ?? Grid2X2;
  return <Icon className={className} aria-hidden="true" />;
}
