import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "My Pharmacist dashboard",
  description: "Which doses the people sharing from My Pharmacist took, as their scans saw them.",
};

// Light only, in the system's fonts, like the app (globals.css).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
