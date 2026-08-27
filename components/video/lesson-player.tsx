"use client";

import { useEffect, useRef, useState } from "react";
import "video.js/dist/video-js.css";
import "./elshemey-player.css";

/**
 * EL-SHEMEY lesson player (Video.js, self-hosted MP4/HLS-ready).
 *
 * - src comes exclusively from the server-authorized signed stream URL.
 * - Reports playback position for resume support; when watched time crosses
 *   the configurable completion threshold it enables lesson completion —
 *   loading the video NEVER completes a lesson by itself.
 * - Loading/error states are honest; retry re-loads without page reload.
 */

export interface LessonPlayerProps {
  src: string;
  courseSlug: string;
  lessonSlug: string;
  resumeAt?: number | null;
  alreadyCompleted?: boolean;
  /** 0–1; per-lesson override wins over the platform default. */
  completionThreshold?: number;
  captions?: Array<{ src: string; label: string; language: string }>;
  strings: {
    errorTitle: string;
    errorRetry: string;
    completeUnlocked: string;
  };
  onCompleted?: () => void;
}

type VjsPlayer = import("video.js/dist/types/player").default;

const POSITION_SAVE_INTERVAL_MS = 10_000;

export function LessonPlayer({
  src,
  courseSlug,
  lessonSlug,
  resumeAt = null,
  alreadyCompleted = false,
  completionThreshold = Number(
    process.env.NEXT_PUBLIC_VIDEO_COMPLETION_THRESHOLD ?? "0.9",
  ),
  captions,
  strings,
}: LessonPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<VjsPlayer | null>(null);
  const [errorState, setErrorState] = useState(false);
  const [completeUnlocked, setCompleteUnlocked] = useState(alreadyCompleted);

  const positionRef = useRef({ lastSaved: 0 });
  const completedRef = useRef(alreadyCompleted);
  const propsRef = useRef({ src, courseSlug, lessonSlug, resumeAt, captions });

  useEffect(() => {
    propsRef.current = { src, courseSlug, lessonSlug, resumeAt, captions };
  }, [src, courseSlug, lessonSlug, resumeAt, captions]);

  // Create the player once; swap sources via the API afterwards.
  useEffect(() => {
    if (!videoRef.current) return;
    let cancelled = false;
    let current: VjsPlayer | null = null;

    (async () => {
      const { default: videojs } = await import("video.js");
      if (cancelled || !videoRef.current) return;

      // Picture-in-Picture control (where supported).
      const Button = videojs.getComponent("Button");
      const PipButton = class extends Button {
        buildCSSClass() {
          return `vjs-pip-button ${super.buildCSSClass()}`;
        }
        handleClick() {
          const el = this.player()?.el()?.querySelector("video");
          if (!el) return;
          if (document.pictureInPictureElement) {
            void document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            void el.requestPictureInPicture();
          }
        }
        controlText_ = "Picture in picture";
      };
      videojs.registerComponent("PipButton", PipButton);

      current = videojs(videoRef.current, {
        controls: true,
        fluid: true,
        preload: "metadata",
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        responsive: true,
        controlBar: {
          pictureInPictureToggle: false,
        },
        sources: [{ src: propsRef.current.src, type: "video/mp4" }],
        html5: { vhs: { overrideNative: true } },
      }) as VjsPlayer;

      // Custom PiP button after fullscreen toggle.
      const bar = current.getChild("controlBar");
      if (bar) bar.addChild("PipButton", {}, bar.children().length - 1);

      current.on("loadedmetadata", () => {
        const resume = propsRef.current.resumeAt ?? 0;
        if (resume > 5 && !completedRef.current) {
          try {
            current?.currentTime(resume);
          } catch {}
        }
      });

      current.on("timeupdate", () => {
        const p = current;
        if (!p) return;
        const now = Date.now();
        const t = p.currentTime() ?? 0;
        if (now - positionRef.current.lastSaved > POSITION_SAVE_INTERVAL_MS && t > 0) {
          positionRef.current.lastSaved = now;
          void fetch("/api/learn/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseSlug: propsRef.current.courseSlug,
              lessonSlug: propsRef.current.lessonSlug,
              positionSeconds: Math.floor(t),
            }),
          }).catch(() => {});
        }
        const duration = p.duration() ?? 0;
        if (
          !completedRef.current &&
          duration > 0 &&
          t / duration >= completionThreshold
        ) {
          completedRef.current = true;
          setCompleteUnlocked(true);
        }
      });

      current.on("error", () => setErrorState(true));
      current.on("playing", () => setErrorState(false));

      for (const track of propsRef.current.captions ?? []) {
        current.addRemoteTextTrack(
          {
            src: track.src,
            label: track.label,
            language: track.language,
            kind: "captions",
          },
          false,
        );
      }

      playerRef.current = current;
    })();

    return () => {
      cancelled = true;
      playerRef.current?.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Authorized source changed (e.g. token rotation) → swap via API only.
  useEffect(() => {
    const p = playerRef.current;
    if (p && p.currentSrc() !== src) {
      p.src({ src, type: "video/mp4" });
    }
  }, [src]);

  function retry() {
    const p = playerRef.current;
    if (!p) return;
    setErrorState(false);
    p.error(null);
    p.src({ src, type: "video/mp4" });
    p.load();
    void p.play()?.catch(() => {});
  }

  return (
    <div ref={containerRef} className="relative">
      <div data-vjs-player>
        <video ref={videoRef} className="video-js vjs-elshemey" playsInline />
      </div>

      {errorState && (
        <div
          role="alert"
          className="absolute inset-0 z-30 grid place-items-center rounded-md bg-base/90 p-6 text-center"
        >
          <div>
            <p className="text-sm font-semibold text-error">{strings.errorTitle}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 rounded-sm border-2 border-edge-strong px-4 py-2 text-xs font-semibold transition-colors hover:border-indigo"
            >
              {strings.errorRetry}
            </button>
          </div>
        </div>
      )}

      {completeUnlocked && !alreadyCompleted && (
        <p
          role="status"
          className="mt-2 font-mono text-[10px] uppercase tracking-widest text-beginner"
        >
          ✓ {strings.completeUnlocked}
        </p>
      )}
    </div>
  );
}
