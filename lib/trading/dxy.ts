// DXY (US Dollar Index) alignment. Gold, EUR, GBP and AUD move AGAINST the dollar; USD/JPY and USD/CAD move WITH it.
// A trade is "aligned" when the dollar index agrees with it on the higher timeframe AND does not contradict it on the setup timeframe.
import type { Dir } from "./engine";
import type { Inst } from "./config";

export type DxyCtx = { htf: Dir | null; ltf: Dir | null; last: number };
export type DxyState = "aligned" | "neutral" | "conflict";
export type DxyView = {
  htf: Dir | null; ltf: Dir | null; last: number;
  corr: 1 | -1;
  favours: Dir | null;                       // the trade direction the dollar currently supports for this pair
  buy: DxyState; sell: DxyState;
  filter: boolean;                           // true when unaligned setups are held back
};

const flip = (d: Dir): Dir => (d === "BUY" ? "SELL" : "BUY");

// How a BUY or SELL on this pair lines up with the dollar
export function dxyCheck(dir: Dir, corr: 1 | -1, c: DxyCtx): DxyState {
  const need = corr === -1 ? flip(dir) : dir;
  if (c.htf === flip(need)) return "conflict";
  if (c.htf === need && c.ltf !== flip(need)) return "aligned";
  return "neutral";
}

export function dxyView(ins: Inst, c: DxyCtx, filter: boolean): DxyView | null {
  if (!ins.dxy) return null;
  const favours = c.htf === null ? null : ins.dxy === -1 ? flip(c.htf) : c.htf;
  return { htf: c.htf, ltf: c.ltf, last: c.last, corr: ins.dxy, favours, buy: dxyCheck("BUY", ins.dxy, c), sell: dxyCheck("SELL", ins.dxy, c), filter };
}

const word = (d: Dir | null) => (d === "BUY" ? "rising" : d === "SELL" ? "falling" : "flat");
export function dxyText(dir: Dir, state: DxyState, c: DxyCtx, L: { h: string; m: string }, label: string): string {
  const frames = `DXY ${word(c.htf)} on ${L.h}, ${word(c.ltf)} on ${L.m}`;
  if (state === "aligned") return `DXY aligned: ${frames}, which supports ${label} ${dir}`;
  if (state === "conflict") return `DXY conflict: ${frames}, which works against ${label} ${dir}`;
  return `DXY not confirmed: ${frames}`;
}
