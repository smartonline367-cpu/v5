import { NextResponse } from "next/server";
import { getBundle, getDxy, frameFor } from "@/lib/market/data";
import { dxyContext } from "@/lib/trading/dxy-context";
import { scan } from "@/lib/trading/engine";
import { instOf, TIMEFRAMES } from "@/lib/trading/config";
import { STRATEGIES } from "@/lib/alerts/settings";

export const dynamic = "force-dynamic";

// Scans every timeframe for one pair in a single call, so all timeframes stay live together.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const instrument = q.get("instrument") ?? "EUR_USD";
  const ins = instOf(instrument);
  if (!ins) return NextResponse.json({ error: "Unsupported pair" }, { status: 400 });
  const st = q.get("st"), rr = Number(q.get("rr"));
  const opts = {
    strategies: st === null ? undefined : STRATEGIES.filter((s) => st.split(",").includes(s)),
    minRR: Number.isFinite(rr) && rr >= 1 && rr <= 10 ? rr : undefined,
    sessionFilter: q.get("sess") !== "0",
    dxyFilter: q.get("dx") !== "0",
  };
  // DXY (US Dollar Index) is read only for pairs that move with or against the dollar
  const [b, dxb] = await Promise.all([getBundle(instrument), ins.dxy ? getDxy().catch(() => null) : null]);
  const results = Object.fromEntries(
    TIMEFRAMES.map((tf) => [tf.id, { htf: tf.htf, ltf: tf.ltf, ...scan(frameFor(b, tf), ins, tf, { ...opts, dxy: dxb ? dxyContext(frameFor(dxb, tf)) : null }) }])
  );
  return NextResponse.json({ instrument, demo: b.demo, source: b.source, error: b.error, dxy: { used: !!ins.dxy, live: !!dxb }, at: new Date().toISOString(), results });
}
