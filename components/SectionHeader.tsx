import { GUIDE, type GuideId } from "@/lib/guide";
import { GuideButton } from "./GuidePanel";
export default function SectionHeader({
  id,
  title,
  headingId,
  page = false,
}: {
  id: GuideId;
  title?: string;
  headingId?: string;
  page?: boolean;
}) {
  const Heading = page ? "h1" : "h2";
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <Heading
          id={headingId}
          className={
            page
              ? "text-4xl font-semibold tracking-tight sm:text-5xl"
              : "text-xl font-semibold tracking-tight sm:text-2xl"
          }
        >
          {title ?? GUIDE[id].name}
        </Heading>
        <p className="mt-2 text-sm text-muted-foreground">{GUIDE[id].hook}</p>
      </div>
      <GuideButton id={id} />
    </div>
  );
}
