# EL-SHEMEY — Video & Media Architecture (Phase 5A)

> Self-hosted, owner-controlled video system. **No Bunny Stream, no Cloudflare
> Stream, no third-party paid video provider.**

## 1. Overview

```
Owner (Admin Dashboard)
   │  upload (multipart POST /api/admin/videos/upload)
   ▼
EL-SHEMEY server ── magic-byte sniff → size cap stream → VideoStorageProvider.save()
   │                                        storage/videos/{videoId}/original.mp4
   ▼
MP4 container probe (duration/width/height) → status PROCESSING → READY
   │
Learner requests lesson page
   ▼
authorizePlayback(userId, lessonSlug)      ← the ONE access decision
   │  session → lesson → module → course → publish states → entitlement
   ▼
short-lived signed URL  /api/videos/{videoId}/stream?token=…&expires=…
   ▼
Stream route RE-RUNS full authorization → HTTP 206 Range streaming from storage
   ▼
Video.js player (custom EL-SHEMEY skin) in the browser
```

## 2. VideoStorageProvider abstraction

`lib/server/video/storage.ts` defines the boundary:

| Operation   | Purpose                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `save`      | Streams bytes to storage with a hard size cap; removes partial files on failure |
| `openRange` | Opens a byte range for HTTP Range seeking                                       |
| `stat`      | Size lookup (existence oracle is deliberately absent for invalid refs)          |
| `delete`    | Removes stored bytes                                                            |

- **LOCAL DEVELOPMENT**: `local-fs` driver rooted at `VIDEO_STORAGE_ROOT`
  (default `./storage/videos`). Free, no external service.
- **PRODUCTION STORAGE (pending)**: S3-compatible object storage replaces the
  driver behind the same interface. It does **not exist yet** — there is no
  pretend-S3 fallback; an unknown `VIDEO_STORAGE_DRIVER` fails loudly.
- Storage refs are opaque server-generated keys (`{videoId}/original.mp4`).
  Client filenames are discarded. Refs are validated against a strict charset
  and resolved with a root-containment check (path traversal impossible).

## 3. Upload security (`POST /api/admin/videos/upload`)

- ADMIN role re-verified from the live session on every request.
- Content type decided by **magic bytes** (`ftyp` → MP4, EBML → WebM).
  Client-supplied MIME type, filename and extension are never trusted.
- Size capped server-side **while streaming** (no full buffering);
  default 2048 MB (`VIDEO_MAX_UPLOAD_MB`).
- Partial/failed uploads delete both bytes and DB row — a partially uploaded
  video can never be playable.
- Every upload writes an audit entry (`video.uploaded`).

## 4. Playback authorization

One authoritative function: `authorizePlayback()` in
`lib/server/video/playback.ts`. Rules:

1. Verified session required (anonymous users have no path in by design).
2. Lesson, module and course must all be `PUBLISHED`.
3. FREE lessons pass; PRO lessons require the EntitlementProvider
   (active subscription). Admins may preview everything (owner preview).
4. A `READY`, non-archived video must be attached.
5. A **short-lived signed URL** (HMAC-SHA256, 10-minute TTL,
   `VIDEO_STREAM_SIGNING_KEY` or derived from `AUTH_SECRET`) is issued.

**Signed URLs are hotlink protection only — not the authorization mechanism.**
The stream route re-runs the complete authorization chain on every request,
so expired entitlements stop working immediately even with a valid token.

### Honest protection statement

This is educational-content protection, not DRM:

- What IS implemented: authentication, entitlement gating, publish-state
  checks, signed short-lived URLs, private/no-store responses, no filesystem
  paths or storage credentials in any API response, IDOR-safe by design.
- What CANNOT be prevented by any self-hosted setup: a determined subscriber
  recording their screen. The design raises the bar (per-request authz, expiring
  URLs) without claiming absolute security.

## 5. Streaming route

`GET/HEAD /api/videos/[videoId]/stream`

- Full authorization chain per request (see above).
- HTTP Range support (206 + Content-Range) so seeking works.
- `Cache-Control: private, no-store`; `X-Content-Type-Options: nosniff`.
- Unknown/forbidden videos always return bare 404s — nothing leaks.
- No storage refs or filesystem paths ever appear in responses.

## 6. Processing

- Phase scope: reliable **MP4 playback** (WebM accepted at upload).
- Metadata (duration, dimensions) extracted server-side from MP4 boxes
  (`lib/server/video/probe.ts`) — zero dependencies, no FFmpeg requirement.
- FFmpeg/HLS transcoding is an _optional future seam_: `detectFfmpeg()`
  reports availability; nothing depends on it. Future pipeline:
  `original.mp4 → ffmpeg → master.m3u8 (1080p/720p/480p/360p)` — the storage
  ref scheme already supports multiple renditions per video.

## 7. Player

Video.js (open-source, MIT) with a custom EL-SHEMEY skin
(`components/video/elshemey-player.css`): graphite foundation, indigo/electric
accents, mono time display, RTL-safe control bar.

Controls: play/pause · seek · volume · playback speed · fullscreen ·
picture-in-picture (where supported) · progress · time/duration · loading
state · error state with retry · captions/subtitles track foundation.

Completion policy: when watched time crosses the configurable threshold
(`NEXT_PUBLIC_VIDEO_COMPLETION_THRESHOLD`, default 0.9), completion is
unlocked and position is saved every 10 s (`/api/learn/progress`,
server-authoritative). **Loading a video never completes a lesson.**

## 8. Database

Migration `0006_self_hosted_video` (deterministic SQL):

- `VideoAsset.bunnyVideoId` → renamed to `storageRef` (unique, opaque key)
- Added: `fileSizeBytes BIGINT`, `width INT`, `height INT`, `mimeType TEXT`
- Existing `status` enum (UPLOADING/PROCESSING/READY/FAILED/ARCHIVED),
  lesson relation and audit integration reused unchanged.
- Binaries never enter PostgreSQL.

## 9. Local vs production

| Aspect        | Now (local dev)                 | Production (pending)                                          |
| ------------- | ------------------------------- | ------------------------------------------------------------- |
| Storage       | local FS driver                 | S3-compatible driver (same interface)                         |
| Upload limits | 2048 MB default                 | tune per hosting; consider direct-to-bucket presigned uploads |
| Delivery      | streamed through Next.js server | may add CDN in front of authorized routes                     |

Do not claim production storage exists until the S3-compatible driver is
implemented and verified.
