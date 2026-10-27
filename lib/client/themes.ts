// Three colour designs. The colours live in styles/theme.css; bg and grid colour the TradingView chart to match.
export const THEMES = [
  { id: "noir", name: "Gold Noir", bg: "#07070a", grid: "rgba(212,175,55,0.08)" },
  { id: "ocean", name: "Ocean Neon", bg: "#040a18", grid: "rgba(34,211,238,0.09)" },
  { id: "royal", name: "Royal Violet", bg: "#090513", grid: "rgba(167,139,250,0.10)" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

// Browser storage keys
export const STORAGE = {
  settings: "kitibwa.settings.v2",
  sent: "kitibwa.sent.v1",
  theme: "kitibwa.theme.v1",
  music: "kitibwa.music.v1",
  voice: "kitibwa.voice.v1",
} as const;
