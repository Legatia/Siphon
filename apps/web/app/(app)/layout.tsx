import { Navbar } from "@/components/layout/navbar";
import { OnboardingTracker } from "@/components/onboarding-tracker";
import { RouteTransitionShell } from "@/components/route-transition-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="particle-bg min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <OnboardingTracker />
        <RouteTransitionShell>{children}</RouteTransitionShell>
      </main>
    </div>
  );
}
