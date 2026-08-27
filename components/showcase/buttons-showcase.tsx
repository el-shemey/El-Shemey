import { Button, IconButton } from "@/components/ui/button";
import { AccessStamp, Chip, LevelBadge } from "@/components/ui/badge";
import { Stat, TechLabel } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";

export function ButtonsShowcase() {
  return (
    <div className="space-y-12">
      <section aria-label="Button variants">
        <TechLabel>Variants</TechLabel>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <a
            href="#"
            className="text-sm font-semibold underline decoration-electric decoration-2 underline-offset-4 hover:text-violet"
          >
            Text link
          </a>
        </div>
      </section>

      <section aria-label="Button sizes">
        <TechLabel>Sizes</TechLabel>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section aria-label="Button states">
        <TechLabel>States — loading · disabled · icon · tooltip</TechLabel>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Tooltip label="Search shortcuts: press /">
            <IconButton label="Search" variant="secondary">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-4 fill-none stroke-current stroke-[1.5]"
              >
                <circle cx="7" cy="7" r="4.75" />
                <path d="m11 11 3.5 3.5" strokeLinecap="round" />
              </svg>
            </IconButton>
          </Tooltip>
          <Tooltip label="Delete draft">
            <IconButton label="Delete" variant="ghost">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-4 fill-none stroke-error stroke-[1.5]"
              >
                <path
                  d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.8 9.5h6.4L12 4M6.7 7v4M9.3 7v4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
          </Tooltip>
        </div>
      </section>

      <section aria-label="Badges and tags">
        <TechLabel>Badges · stamps · chips</TechLabel>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <LevelBadge level="beginner" />
          <LevelBadge level="intermediate" />
          <LevelBadge level="advanced" />
          <span className="inline-flex items-center gap-2">
            <AccessStamp kind="FREE" /> <AccessStamp kind="PRO" />
          </span>
          <Chip>Prompting</Chip>
          <Chip>n8n</Chip>
          <Chip>AI agents</Chip>
        </div>
      </section>

      <section aria-label="Stats">
        <TechLabel>Stats</TechLabel>
        <div className="mt-4 flex flex-wrap gap-x-14 gap-y-6 border-y border-edge py-6">
          <Stat value="24" label="Lessons" labelAr="درسًا" />
          <Stat value="82%" label="Average completion" labelAr="متوسط الإكمال" />
          <Stat value="~9h" label="Focused hours" labelAr="ساعة تركيز" />
        </div>
      </section>
    </div>
  );
}
