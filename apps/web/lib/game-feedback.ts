"use client";

type SfxEvent =
  | "capture_success"
  | "capture_fail"
  | "xp_gain"
  | "level_up"
  | "battle_submit"
  | "battle_win"
  | "battle_lose"
  | "timer_warning";

type CelebrationType = "capture" | "level_up" | "battle_win";

type OnboardingState = {
  driftVisited: boolean;
  captured: boolean;
  trained: boolean;
  battled: boolean;
};

const defaultOnboarding: OnboardingState = {
  driftVisited: false,
  captured: false,
  trained: false,
  battled: false,
};

function onboardingKey(ownerId: string) {
  return `siphon:onboarding:${ownerId.toLowerCase()}`;
}

export function getOnboardingProgress(ownerId?: string): OnboardingState {
  if (!ownerId || typeof window === "undefined") return defaultOnboarding;
  try {
    const raw = window.localStorage.getItem(onboardingKey(ownerId));
    if (!raw) return defaultOnboarding;
    return { ...defaultOnboarding, ...(JSON.parse(raw) as Partial<OnboardingState>) };
  } catch {
    return defaultOnboarding;
  }
}

export function updateOnboardingProgress(
  ownerId: string | undefined,
  patch: Partial<OnboardingState>
) {
  if (!ownerId || typeof window === "undefined") return;
  const next = { ...getOnboardingProgress(ownerId), ...patch };
  window.localStorage.setItem(onboardingKey(ownerId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("siphon:onboarding", { detail: next }));
}

export function playSfx(event: SfxEvent) {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";

  const now = ctx.currentTime;
  const profiles: Record<SfxEvent, [number, number]> = {
    capture_success: [660, 920],
    capture_fail: [220, 180],
    xp_gain: [540, 700],
    level_up: [700, 980],
    battle_submit: [350, 420],
    battle_win: [520, 860],
    battle_lose: [300, 180],
    timer_warning: [780, 720],
  };
  const [from, to] = profiles[event];
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + 0.2);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.24);
  setTimeout(() => {
    ctx.close().catch(() => {});
  }, 350);
}

export function triggerCelebration(type: CelebrationType) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("siphon:celebrate", { detail: { type } }));
}
