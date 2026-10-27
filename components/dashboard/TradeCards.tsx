import type { Filled, Pending } from "@/lib/trading/engine";
import { ACTION_TEXT } from "@/lib/alerts/notify";

export function LimitCard({ p, show, units }: { p: Pending; show: number; units?: string }) {
  return (
    <div className="card setup pend">
      <div className="row">
        <div className={`big ${p.dir === "BUY" ? "up" : "down"}`} style={{ fontSize: 18 }}>{p.strategy}: {p.dir} LIMIT</div>
        <span className="tag">FORMING</span>
      </div>
      <div className="small">Entry {p.entry.toFixed(show)} | SL {p.sl.toFixed(show)} | TP {p.tp.toFixed(show)} | RR {p.rr}</div>
      <div className="small">Price is {p.dist} pips from the entry{units ? ` | ${units}` : ""}</div>
      <ul className="small">{p.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

function ChangeBox({ c, f, show }: { c: NonNullable<Filled["change"]>; f: Filled; show: number }) {
  return (
    <div className={`chg ${c.level}`} role="alert">
      <div className="row">
        <span className="act">ORDER CHANGE: {ACTION_TEXT[c.action]}</span>
        <span className={`tag ${c.level === "DANGER" ? "r" : ""}`}>{c.level}</span>
      </div>
      <div className="why">Warning: {c.reason}</div>
      <div className="nums">
        {c.sl !== undefined && <>Stop loss <b>{f.sl.toFixed(show)}</b> to <b>{c.sl.toFixed(show)}</b>. </>}
        {c.tp !== undefined && <>Take profit <b>{f.tp.toFixed(show)}</b> to <b>{c.tp.toFixed(show)}</b>. </>}
        {c.action === "CLOSE_EARLY" && <>Close the trade now instead of waiting for the stop at <b>{f.sl.toFixed(show)}</b>.</>}
      </div>
    </div>
  );
}

// A running trade: progress toward the target, floating result, and the automatic order change when it is failing
export function PositionCard({ f, show, pip, px, tf }: { f: Filled; show: number; pip: number; px?: number; tf?: string }) {
  const buy = f.dir === "BUY";
  const t = new Date(f.since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const live = px ? Number((((buy ? px - f.entry : f.entry - px)) / pip).toFixed(1)) : f.pnl;
  const toTp = px ? Math.max(0, Number((Math.abs(f.tp - px) / pip).toFixed(1))) : null;
  const toSl = px ? Math.max(0, Number((Math.abs(px - f.sl) / pip).toFixed(1))) : null;
  return (
    <div className={`pos ${buy ? "buy" : "sell"} ${f.change ? "chg" : ""}`}>
      <div className="row">
        <div className={`big ${buy ? "up" : "down"}`} style={{ fontSize: 18, marginTop: 0 }}>{tf ? `${tf} ` : ""}{f.strategy}: {f.dir}</div>
        <span className="tag g">RUNNING</span>
      </div>
      <div className="bar" aria-label={`${f.prog}% of the way to the target`}><i style={{ width: `${f.prog}%` }} /></div>
      <div className="stats">
        <span>Best progress <b>{f.prog}%</b></span>
        <span className={live >= 0 ? "up" : "down"}>Floating <b>{live >= 0 ? "+" : ""}{live} pips</b></span>
        {toTp !== null && <span>To TP <b>{toTp}</b></span>}
        {toSl !== null && <span>To SL <b>{toSl}</b></span>}
        <span>Since <b>{t}</b> ({f.bars} candles)</span>
      </div>
      <div className="small" style={{ marginTop: 0 }}>Entry {f.entry.toFixed(show)} | SL {f.sl.toFixed(show)} | TP {f.tp.toFixed(show)} | RR {f.rr}</div>
      {f.change ? <ChangeBox c={f.change} f={f} show={show} /> : <div className="small" style={{ marginTop: 0 }}>On track. The bot is watching it and will propose an order change with a warning if it fails to reach the target.</div>}
    </div>
  );
}
