"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { ConfirmDanger, Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/menu";
import { EmptyCoursesExample, Skeleton } from "@/components/ui/states";
import { toast, ToastViewport } from "@/components/ui/toast";

const initialTags = ["Prompting", "n8n", "AI agents"];

export function FeedbackShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [tags, setTags] = useState(initialTags);

  return (
    <div className="space-y-14">
      {/* Alerts */}
      <section aria-label="Alerts">
        <div className="grid gap-3 sm:grid-cols-2">
          <Alert variant="info" title="Heads up">
            Module 4 unlocks after your subscription renews.
          </Alert>
          <Alert variant="success" title="Saved">
            Your progress synced across devices.
          </Alert>
          <Alert variant="warning" title="Payment retrying">
            We&apos;ll try your card again tomorrow — no action needed yet.
          </Alert>
          <Alert variant="error" title="Link expired">
            This verification link is older than 24 hours. Request a fresh one.
          </Alert>
        </div>
      </section>

      {/* Toasts + removable chip */}
      <section aria-label="Toasts">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast({
                title: "Lesson completed",
                description: "Progress saved.",
                variant: "success",
              })
            }
          >
            Fire success toast
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast({
                title: "Renewal failed",
                description: "We'll retry in 24h.",
                variant: "error",
              })
            }
          >
            Fire error toast
          </Button>
          {tags.map((tag) => (
            <Chip key={tag} onRemove={() => setTags(tags.filter((t) => t !== tag))}>
              {tag}
            </Chip>
          ))}
        </div>
      </section>

      {/* Dialogs + dropdown */}
      <section aria-label="Overlays">
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDangerOpen(true)}>
            Delete draft…
          </Button>
          <DropdownMenu
            trigger="Course actions"
            align="start"
            items={[
              { label: "Resume learning", onSelect: () => {} },
              { label: "Download resources", onSelect: () => {} },
              { label: "Reset progress", onSelect: () => {}, destructive: true },
            ]}
          />
        </div>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Subscription"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
                Not now
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(false)}>
                View plans
              </Button>
            </>
          }
        >
          Your free lessons keep working forever. PRO unlocks the full library — every
          module, every workflow, in Arabic and English.
        </Dialog>

        <ConfirmDanger
          open={dangerOpen}
          onClose={() => setDangerOpen(false)}
          onConfirm={() => toast({ title: "Draft deleted", variant: "warning" })}
          title="Delete draft?"
        >
          This removes your saved draft prompt. There is no undo.
        </ConfirmDanger>

        <ToastViewport />
      </section>

      {/* Empty + loading */}
      <section aria-label="Empty and loading states">
        <div className="grid gap-6 lg:grid-cols-2">
          <EmptyCoursesExample />
          <div
            className="rounded-md border border-edge-strong bg-surface p-5 shadow-card"
            aria-busy="true"
          >
            <span className="sr-only">Loading course content…</span>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-7 w-56" />
            <Skeleton className="mt-3 h-7 w-40" />
            <Skeleton className="mt-5 h-16 w-full" />
            <div className="mt-5 flex gap-3">
              <Skeleton className="h-9 w-28 rounded-sm" />
              <Skeleton className="h-9 w-36 rounded-sm" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
