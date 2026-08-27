import { redirect } from "next/navigation";

/** Media management moved to the central library at /admin/media. */
export default function AdminVideosRedirect() {
  redirect("/admin/media");
}
