import { Navbar } from "@/components/layout/navbar";
import { OnboardingTracker } from "@/components/onboarding-tracker";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="particle-bg min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OnboardingTracker />
        {children}
      </main>
    </div>
  );
}
