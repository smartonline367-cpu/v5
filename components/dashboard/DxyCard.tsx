import type { DxyView } from "@/lib/trading/dxy";

const arrow = (d: "BUY" | "SELL" | null) => (d === "BUY" ? "rising" : d === "SELL" ? "falling" : "flat");
const cls = (s: string) => (s === "aligned" ? "up" : s === "conflict" ? "down" : "muted");

// Shows what the US Dollar Index says about the selected pair, so entries only go ahead when both agree.
export default function DxyCard({ dxy, used, live, htf, ltf, label }: { dxy: DxyView | null; used: boolean; live: boolean; htf: string; ltf: string; label: string }) {
  if (!used) {
    return (
      <div className="card kpi dxy">
        <div className="label">DXY alignment</div>
        <div className="big muted">N/A</div>
        <div className="small" style={{ marginTop: 2 }}>Not used for {label}</div>
      </div>
    );
  }
  if (!live || !dxy) {
    return (
      <div className="card kpi dxy">
        <div className="label">DXY alignment</div>
        <div className="big muted">NO FEED</div>
        <div className="small" style={{ marginTop: 2 }}>Dollar index not reachable. Setups are not held back.</div>
      </div>
    );
  }
  const side = dxy.favours;
  return (
    <div className={`card kpi dxy ${side === "BUY" ? "buy" : side === "SELL" ? "sell" : ""}`}>
      <div className="label">DXY alignment | {dxy.last.toFixed(2)}</div>
      <div className={`big ${side === "BUY" ? "up" : side === "SELL" ? "down" : ""}`}>{side ? `Favours ${side}` : "NEUTRAL"}</div>
      <div className="small" style={{ marginTop: 2 }}>
        DXY {arrow(dxy.htf)} on {htf}, {arrow(dxy.ltf)} on {ltf}
      </div>
      <div className="dxyrow small">
        <span>BUY <b className={cls(dxy.buy)}>{dxy.buy}</b></span>
        <span>SELL <b className={cls(dxy.sell)}>{dxy.sell}</b></span>
        <span className={`tag ${dxy.filter ? "g" : ""}`}>{dxy.filter ? "FILTER ON" : "INFO ONLY"}</span>
      </div>
    </div>
  );
}
