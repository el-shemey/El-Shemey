import Link from "next/link";
import { Shimmy } from "@/components/character/shimmy";

export default function LocaleNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24 surface-grid">
      <div className="max-w-sm text-center">
        <Shimmy mood="sleepy" size={120} className="mx-auto" />
        <h1 className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-faint">
          404 — off the grid
        </h1>
        <p
          lang="ar"
          dir="rtl"
          className="mt-3 font-arabic text-lg font-semibold text-soft"
        >
          الصفحة دي مش على الخريطة.
        </p>
        <Link
          href="/en"
          className="mt-8 inline-block rounded-sm bg-indigo px-7 py-3.5 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-0.5"
        >
          ← EL-SHEMEY
        </Link>
      </div>
    </main>
  );
}
