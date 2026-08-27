import type { Metadata } from "next";
import "@/app/globals.css";
import { fontVars } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${fontVars} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-base font-sans text-fg">
        {children}
      </body>
    </html>
  );
}
