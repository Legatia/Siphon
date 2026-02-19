import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siphon Protocol",
  description: "Discover, capture, and train AI Shards from the digital deep",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen particle-bg">
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
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
