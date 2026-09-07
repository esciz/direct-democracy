export function guidedOnboardingStep(requested: string | undefined, signedIn: boolean, demoEnabled: boolean) {
  // Real accounts already exist when they reach this authenticated setup page.
  if (signedIn && !demoEnabled && (!requested || requested === "account")) return "setup";
  return requested ?? "account";
}
