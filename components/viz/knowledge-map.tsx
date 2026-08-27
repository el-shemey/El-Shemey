import { cn } from "@/lib/cn";

/**
 * The Knowledge Map — courses as connected destinations on the grid.
 * This is the signature EL-SHEMEY exploration structure: nodes, lit paths,
 * soft glow on the current position. Sophisticated, not a videogame HUD.
 */

export type MapNode = {
  id: string;
  title: string;
  titleAr?: string;
  hint?: string;
  meta?: string;
  access?: "FREE" | "PRO";
  state: "done" | "current" | "available" | "locked";
  href?: string;
};

function nodeVisual(state: MapNode["state"]) {
  switch (state) {
    case "done":
      return {
        dot: "bg-beginner shadow-glow",
        ring: "border-beginner/50",
        title: "text-fg",
        line: "via-beginner/40",
      };
    case "current":
      return {
        dot: "node-live bg-electric",
        ring: "border-electric/70 bg-electric/10",
        title: "text-fg font-semibold",
        line: "via-electric/40",
      };
    case "locked":
      return {
        dot: "bg-hover border border-edge-strong",
        ring: "border-edge bg-surface/60",
        title: "text-faint",
        line: "via-edge-strong",
      };
    default:
      return {
        dot: "bg-indigo/70",
        ring: "border-indigo/40 hover:border-indigo hover:bg-indigo/10",
        title: "text-fg group-hover:text-electric",
        line: "via-indigo/30",
      };
  }
}

export function KnowledgeMap({
  nodes,
  className,
}: {
  nodes: MapNode[];
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-1", className)}>
      {nodes.map((node, i) => {
        const v = nodeVisual(node.state);
        const isLast = i === nodes.length - 1;
        return (
          <li key={node.id} role="none" className="relative">
            <a
              href={node.href ?? "#"}
              aria-current={node.state === "current" ? "true" : undefined}
              className={cn(
                "group flex items-center gap-4 rounded-sm border px-4 py-3.5 transition-colors duration-200",
                v.ring,
              )}
            >
              {/* node */}
              <span
                aria-hidden
                className={cn("size-3 shrink-0 rounded-full transition-shadow", v.dot)}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", v.title)}>
                  {node.title}
                </span>
                {node.titleAr && (
                  <span
                    lang="ar"
                    dir="rtl"
                    className="block truncate font-arabic text-xs text-faint"
                  >
                    {node.titleAr}
                  </span>
                )}
                {node.hint && (
                  <span className="block max-h-0 overflow-hidden text-xs leading-relaxed text-faint transition-all duration-300 ease-settle group-hover:max-h-10 group-focus-within:max-h-10">
                    {node.hint}
                  </span>
                )}
              </span>
              {node.meta && (
                <span className="ms-auto hidden shrink-0 font-mono text-[11px] tabular-nums text-faint sm:inline">
                  {node.meta}
                </span>
              )}
              {node.access && (
                <span
                  className={cn(
                    "shrink-0 -rotate-2 border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest",
                    node.access === "FREE"
                      ? "border-beginner/60 text-beginner"
                      : "border-gold/60 text-gold",
                  )}
                >
                  {node.access}
                </span>
              )}
            </a>

            {/* connector to next destination */}
            {!isLast && (
              <span aria-hidden className="absolute start-[27px] top-full h-5 w-px">
                <span
                  className={cn(
                    "absolute inset-0 bg-linear-to-b",
                    node.state === "done"
                      ? "from-beginner/50"
                      : node.state === "current"
                        ? "from-electric/60"
                        : "from-indigo/30",
                    "to-edge",
                  )}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
