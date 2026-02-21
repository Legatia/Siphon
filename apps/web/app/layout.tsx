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
      <body className="min-h-screen">
        <Providers>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(230 25% 12%)",
                border: "1px solid hsl(165 100% 42% / 0.2)",
                color: "hsl(200 30% 90%)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
