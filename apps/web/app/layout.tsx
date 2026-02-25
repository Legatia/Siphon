import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siphon Protocol",
  description: "Capture AI agents, train them to think, put them to work — on Base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen pixel-scanlines pixel-vignette">
        <Providers>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(8, 16, 29, 0.95)",
                border: "2px solid rgba(106, 245, 214, 0.45)",
                color: "rgba(213, 244, 255, 0.95)",
                borderRadius: "0",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
