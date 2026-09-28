// The house's official social profiles. Set per deployment — VITE_INSTAGRAM_URL,
// VITE_TIKTOK_URL, VITE_YOUTUBE_URL, VITE_FACEBOOK_URL — and each one becomes a
// footer link and a sameAs entry in the Organization data, so search engines
// can tie the accounts to the site. An unset or non-https value is left out.
//
// A pure function of the env, not a module-level read of import.meta.env:
// scripts/prerender.mjs runs this under Node, where there is no Vite env.

export interface SocialProfile {
  network: "Instagram" | "TikTok" | "YouTube" | "Facebook";
  url: string;
}

const KEYS: [SocialProfile["network"], string][] = [
  ["Instagram", "VITE_INSTAGRAM_URL"],
  ["TikTok", "VITE_TIKTOK_URL"],
  ["YouTube", "VITE_YOUTUBE_URL"],
  ["Facebook", "VITE_FACEBOOK_URL"],
];

export function socialProfiles(env: Record<string, unknown>): SocialProfile[] {
  return KEYS.flatMap(([network, key]) => {
    const url = String(env[key] ?? "").trim();
    return /^https:\/\/[^\s"<>]+$/.test(url) ? [{ network, url }] : [];
  });
}
