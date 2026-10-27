// Reads the dollar's direction from DXY candles. Kept apart from dxy.ts so the engine can import dxy.ts without a circular import.
import { atr, bias, type C, type Dir } from "./engine";
import type { DxyCtx } from "./dxy";

// Direction of the dollar on one frame: swing structure first, otherwise price versus its 20-candle average
function drift(cs: C[]): Dir | null {
  if (cs.length < 25) return null;
  const w = cs.slice(-20), avg = w.reduce((a, k) => a + k.c, 0) / w.length, last = cs[cs.length - 1].c, gap = 0.25 * atr(cs, 14);
  return last > avg + gap ? "BUY" : last < avg - gap ? "SELL" : null;
}
const dirOf = (cs: C[]): Dir | null => (cs.length ? bias(cs) ?? drift(cs) : null);

export function dxyContext(f: { h4: C[]; m15: C[]; m1: C[] }): DxyCtx | null {
  if (!f.m15.length) return null;
  const px = f.m1.length ? f.m1 : f.m15;
  return { htf: dirOf(f.h4), ltf: dirOf(f.m15), last: px[px.length - 1].c };
}
