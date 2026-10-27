// Spoken alerts: picks a clear female English voice on the device and reads numbers digit by digit so nothing is misheard.
import { duck } from "@/lib/client/ambient";
import { STORAGE } from "@/lib/client/themes";

// ---- Voice: a lady's soft, clear voice ----
// The browser decides which voices exist, so the bot picks the best female English voice on this device.
// "Change voice" cycles through the other female voices and the choice is remembered.
const VOICE_KEY = STORAGE.voice;
const FEMALE = /natural|aria|jenny|sonia|libby|ava\b|emma|michelle|natasha|clara|samantha|karen|moira|serena|tessa|allison|susan|zira|hazel|victoria|fiona|female|catherine|linda|heera|eva\b|salli|joanna|kendra|kimberly|ivy|amy\b|nicky|joelle|ellen/i;
const MALE = /\bmale\b|david|mark\b|george|daniel|james|alex\b|fred\b|guy\b|ryan|davis|thomas|oliver|rishi|ravi|arthur|aaron|gordon|christopher|eric|roger|steffan|brian|andrew|jason|tony|liam|sam\b/i;
let chosen: SpeechSynthesisVoice | null = null;
function ladyVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const vs = window.speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang) && !MALE.test(v.name));
  const score = (v: SpeechSynthesisVoice) => (FEMALE.test(v.name) ? 10 : 0) + (/natural|online/i.test(v.name) ? 5 : 0) + (/en[-_](us|gb)/i.test(v.lang) ? 1 : 0) + (v.localService ? 0 : 1);
  return [...vs].sort((x, y) => score(y) - score(x)).filter((v, i, all) => FEMALE.test(v.name) || i === 0 || !all.some((o) => FEMALE.test(o.name)));
}
function pickVoice(): SpeechSynthesisVoice | null {
  if (chosen) return chosen;
  const list = ladyVoices();
  if (!list.length) return null;
  let saved = ""; try { saved = localStorage.getItem(VOICE_KEY) ?? ""; } catch {}
  chosen = list.find((v) => v.name === saved) ?? list[0];
  return chosen;
}
export function nextVoice(): string {
  const list = ladyVoices();
  if (!list.length) return "";
  const i = list.findIndex((v) => v.name === chosen?.name);
  chosen = list[(i + 1) % list.length];
  try { localStorage.setItem(VOICE_KEY, chosen.name); } catch {}
  return chosen.name;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = () => { chosen = null; };

// Numbers are read digit by digit after the point (4139.40 becomes "4139 point 4 0"), so nothing is misheard.
export const num = (n: number, dp: number) => { const [i, d] = n.toFixed(dp).split("."); return d ? `${i} point ${d.split("").join(" ")}` : i; };
const SAY_PAIR: Record<string, string> = { EUR_USD: "Euro Dollar", GBP_USD: "Pound Dollar", USD_JPY: "Dollar Yen", USD_CAD: "Dollar Canadian", AUD_USD: "Aussie Dollar", XAU_USD: "Gold", BTC_USD: "Bitcoin Dollar" };
const SAY_TF: Record<string, string> = { M1: "1 minute", M5: "5 minute", M15: "15 minute", M30: "30 minute", H1: "1 hour", H4: "4 hour", D: "daily", W: "weekly", M: "monthly" };
const SAY_STRAT: Record<string, string> = { CRT: "C R T", CISD: "C I S D", "MSNR+LIT": "M S N R and L I T" };

export function speak(text: string, queue = false) {
  try {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (!queue || synth.pending) synth.cancel(); // test and on/off messages replace; alerts wait their turn, but never pile up
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.rate = 0.9; u.pitch = 1.08; u.volume = 0.95;
    const quiet = () => setTimeout(() => { if (!synth.speaking && !synth.pending) duck(false); }, 250);
    u.onstart = () => duck(true); u.onend = quiet; u.onerror = quiet;
    synth.speak(u);
  } catch {}
}
export function notify(title: string, body: string) {
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body }); } catch {}
}
