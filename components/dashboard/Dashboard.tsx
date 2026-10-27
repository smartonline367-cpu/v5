"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TradingViewChart from "@/components/chart/TradingViewChart";
import NewsPredict from "@/components/prediction/NewsPredict";
import Assistant, { type Watch } from "@/components/assistant/Assistant";
import DxyCard from "@/components/dashboard/DxyCard";
import { LimitCard, PositionCard } from "@/components/dashboard/TradeCards";
import SettingsDrawer, { SettingsButton, type SettingsTab } from "@/components/settings/SettingsDrawer";
import { INSTRUMENTS, TIMEFRAMES, instOf, tfOf } from "@/lib/trading/config";
import type { Filled, Pending, Setup } from "@/lib/trading/engine";
import type { DxyView } from "@/lib/trading/dxy";
import { channelsOf, ACTION_TEXT } from "@/lib/alerts/notify";
import { clean, DEFAULTS, type BotSettings } from "@/lib/alerts/settings";
import { startAmbient, stopAmbient } from "@/lib/client/ambient";
import { beep, beepWarn } from "@/lib/client/sound";
import { nextVoice, notify, num, speak, SAY_PAIR, SAY_STRAT, SAY_TF } from "@/lib/client/voice";
import { clock } from "@/lib/client/format";
import { STORAGE, THEMES, type ThemeId } from "@/lib/client/themes";

type Res = {
  htf: string; ltf: string; bias: string | null; inSession: boolean; sessionOn: boolean; closed: boolean;
  decision: { action: string; why: string }; setups: Setup[]; held: string[]; pending: Pending[]; filled?: Filled[]; dxy: DxyView | null;
};
type Scan = { demo: boolean; error?: string; at: string; dxy?: { used: boolean; live: boolean }; results: Record<string, Res> };
type Px = { demo: boolean; source?: string; bid: number; ask: number; mid: number };
type BotRow = {
  instrument: string; skipped?: string; tf?: string; kind?: string; dir?: string; strategy?: string;
  entry?: string; sl?: string; tp?: string; rr?: number; ok?: boolean; reason?: string; sent?: string;
};
type Bot = { at: Date; status: number; error?: string; skipped?: string; results?: BotRow[]; keys?: string[] };

export default function Dashboard() {
  const [tab, setTab] = useState<"bot" | "pred">("bot");
  const [pair, setPair] = useState("XAU_USD");
  const [tfId, setTfId] = useState("M15");
  const [sc, setSc] = useState<Scan | null>(null);
  const [fail, setFail] = useState(false);
  const [px, setPx] = useState<Px | null>(null);
  const [tick, setTick] = useState<"up" | "down" | "">("");
  const [alertsOn, setAlertsOn] = useState(false);
  const [st, setSt] = useState<BotSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("alerts");
  const [bot, setBot] = useState<Bot | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [music, setMusic] = useState(false);
  const [storeOk, setStoreOk] = useState(true); // false when this browser blocks saving (for example private mode)
  const [theme, setTheme] = useState<ThemeId>("noir");
  const prevKeys = useRef<Set<string>>(new Set()); // what the selected timeframe showed on the last scan
  const voiceCtx = useRef("");                     // pair + timeframe + switch the voice last looked at
  const scFor = useRef("");
  const stRef = useRef(st);
  const sentRef = useRef<string[]>([]);
  const running = useRef(false);
  const lastPx = useRef(0);
  stRef.current = st;
  const ins = instOf(pair)!, tf = tfOf(tfId), th = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const set = (patch: Partial<BotSettings>) => setSt((s) => clean({ ...s, ...patch }));

  // Load and save the settings in this browser
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE.settings); if (raw) setSt(clean(JSON.parse(raw))); } catch {}
    try { sentRef.current = JSON.parse(localStorage.getItem(STORAGE.sent) ?? "[]"); } catch {}
    try { const t = localStorage.getItem(STORAGE.theme); if (THEMES.some((x) => x.id === t)) setTheme(t as ThemeId); } catch {}
    try { localStorage.setItem("kitibwa.check", "1"); localStorage.removeItem("kitibwa.check"); } catch { setStoreOk(false); }
    setReady(true);
  }, []);
  useEffect(() => {
    let want = false; try { want = localStorage.getItem(STORAGE.music) === "1"; } catch {}
    if (!want) return;
    setMusic(true);
    const go = () => { let still = false; try { still = localStorage.getItem(STORAGE.music) === "1"; } catch {} if (still) startAmbient(); window.removeEventListener("pointerdown", go); };
    window.addEventListener("pointerdown", go);
    return () => window.removeEventListener("pointerdown", go);
  }, []);
  useEffect(() => () => stopAmbient(), []);
  const toggleMusic = () => {
    const next = !music;
    setMusic(next);
    try { localStorage.setItem(STORAGE.music, next ? "1" : "0"); } catch {}
    if (next) startAmbient(); else stopAmbient();
  };
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE.theme, theme); } catch {}
  }, [theme, ready]);
  useEffect(() => { if (ready) try { localStorage.setItem(STORAGE.settings, JSON.stringify(st)); } catch {} }, [st, ready]);

  // All timeframes for the selected pair, refreshed every 15 seconds
  const q = `instrument=${pair}&st=${st.strategies.join(",")}&rr=${st.minRR}&sess=${st.sessionFilter ? 1 : 0}&dx=${st.dxyFilter ? 1 : 0}`;
  useEffect(() => {
    let live = true;
    const go = () =>
      fetch(`/api/scan?${q}`, { cache: "no-store" })
        .then((x) => (x.ok ? x.json() : Promise.reject()))
        .then((j) => { if (live) { scFor.current = pair; setSc(j); setFail(false); } })
        .catch(() => { if (live) setFail(true); });
    go();
    const id = setInterval(go, 15000);
    return () => { live = false; clearInterval(id); };
  }, [q, pair]);
  useEffect(() => { setSc(null); setPx(null); lastPx.current = 0; }, [pair]);

  // Live price every 3 seconds
  useEffect(() => {
    let live = true;
    const go = () =>
      fetch(`/api/price?instrument=${pair}`, { cache: "no-store" })
        .then((x) => (x.ok ? x.json() : Promise.reject()))
        .then((j: Px) => {
          if (!live) return;
          if (lastPx.current) setTick(j.mid > lastPx.current ? "up" : j.mid < lastPx.current ? "down" : "");
          lastPx.current = j.mid; setPx(j);
        })
        .catch(() => {});
    go();
    const id = setInterval(go, 3000);
    return () => { live = false; clearInterval(id); };
  }, [pair]);

  // Voice / sound / notification: ONLY for the timeframe selected on the dashboard.
  // Each alert is spoken once when it first appears on that timeframe. Switching pair or timeframe, or turning alerts on,
  // starts from what is already on the screen and stays silent about it, so only new events are read out.
  useEffect(() => {
    if (!sc || scFor.current !== pair) return;
    const r = sc.results[tfId];
    if (!r) return;
    type Ev = { key: string; say: string; msg: string; title: string; warn?: boolean };
    const evs: Ev[] = [];
    const pair_ = SAY_PAIR[pair] ?? ins.label, tf_ = SAY_TF[tfId] ?? tfId, demo = sc.demo ? "Demo signal. " : "";
    const f = (n: number) => n.toFixed(ins.show);
    const add = (s: Setup, kind: "M" | "L" | "C") => {
      const dir = s.dir.toLowerCase(), strat = SAY_STRAT[s.strategy] ?? s.strategy;
      const head = kind === "C" ? "Limit order confirmed. Price reached the entry." : kind === "L" ? "Limit order forming." : "New signal.";
      evs.push({
        key: `${kind}|${s.strategy}|${s.dir}`,
        say: `${sc.demo ? "Demo signal. " : ""}${head} ${pair_}, ${tf_} chart. ${dir}, ${strat}. Entry, ${num(s.entry, ins.show)}. Stop loss, ${num(s.sl, ins.show)}. Take profit, ${num(s.tp, ins.show)}.`,
        msg: `${demo}${kind === "C" ? "Limit order CONFIRMED. " : kind === "L" ? "Limit order forming. " : "New signal. "}${ins.label} ${tfId}, ${s.dir}, ${s.strategy}. Entry ${f(s.entry)}, stop loss ${f(s.sl)}, take profit ${f(s.tp)}, risk to reward ${s.rr}.`,
        title: `${ins.label} ${tfId} ${s.dir}${kind === "C" ? " CONFIRMED" : kind === "L" ? " LIMIT" : ""}`,
      });
    };
    r.setups.filter((s) => !r.held.includes(`${s.strategy}|${s.dir}`)).forEach((s) => add(s, "M")); // setups held back by DXY stay silent
    r.pending.forEach((s) => add(s, "L"));
    (r.filled ?? []).forEach((s) => add(s, "C"));
    for (const x of r.filled ?? []) {
      const c = x.change;
      if (!c) continue;
      evs.push({
        key: `CHG|${x.strategy}|${x.dir}|${c.action}`, warn: true,
        say: `Order change. Warning. ${pair_}, ${tf_} chart. ${x.dir.toLowerCase()} ${SAY_STRAT[x.strategy] ?? x.strategy} is failing to reach its target. ${c.reason.replace(/%/g, " percent")} Action: ${ACTION_TEXT[c.action]}.${c.sl !== undefined ? ` New stop loss, ${num(c.sl, ins.show)}.` : ""}${c.tp !== undefined ? ` New take profit, ${num(c.tp, ins.show)}.` : ""}`,
        msg: `ORDER CHANGE (${c.level}). ${ins.label} ${tfId} ${x.dir} ${x.strategy}: ${c.reason} Action: ${ACTION_TEXT[c.action]}.${c.sl !== undefined ? ` New SL ${f(c.sl)}.` : ""}${c.tp !== undefined ? ` New TP ${f(c.tp)}.` : ""}`,
        title: `${ins.label} ${tfId} ORDER CHANGE`,
      });
    }
    const now = new Set(evs.map((e) => e.key));
    const ctx = `${pair}|${tfId}|${alertsOn}`;
    if (voiceCtx.current !== ctx || !alertsOn) { voiceCtx.current = ctx; prevKeys.current = now; return; } // silent baseline
    const fresh = evs.filter((e) => !prevKeys.current.has(e.key));
    prevKeys.current = now; // an alert that disappears can alert again later when it comes back
    if (!fresh.length) return;
    fresh.sort((x, y) => Number(!!y.warn) - Number(!!x.warn)); // order-change warnings first
    const spoken = fresh.slice(0, 2), more = fresh.length - spoken.length;
    if (fresh.some((e) => e.warn)) beepWarn(); else beep();
    spoken.forEach((e, i) => speak(i === spoken.length - 1 && more > 0 ? `${e.say} ${more} more alert${more > 1 ? "s" : ""} on this chart.` : e.say, true));
    fresh.slice(0, 3).forEach((e) => notify(e.title, e.msg));
  }, [sc, alertsOn, pair, tfId, ins]);

  const sayNow = useCallback((t: string) => speak(t), []);
  const toggleAlerts = () => {
    const next = !alertsOn;
    setAlertsOn(next);
    if (next) {
      beep(); speak(`Online Kitibwa voice alerts are on. Reading the ${SAY_TF[tfId] ?? tfId} chart only.`);
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } else if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  // Alerts. The bot runs while this page is open: every 30 seconds it asks the server to scan and send alerts for NEW setups.
  const runBot = useCallback(async () => {
    const s = stRef.current;
    if (running.current || !s.secret) return;
    running.current = true; setBusy(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST", headers: { "Content-Type": "application/json", "x-bot-secret": s.secret }, body: JSON.stringify({ settings: s, sent: sentRef.current }),
      });
      const j = (await res.json().catch(() => ({}))) as Partial<Bot>;
      if (j.keys?.length) {
        sentRef.current = [...sentRef.current, ...j.keys].slice(-600);
        try { localStorage.setItem(STORAGE.sent, JSON.stringify(sentRef.current)); } catch {}
      }
      setBot({ at: new Date(), status: res.status, ...j });
    } catch { setBot({ at: new Date(), status: 0, error: "Could not reach the bot. Retrying." }); }
    finally { running.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    if (!ready || !st.enabled) return;
    runBot();
    const id = setInterval(runBot, 30000);
    return () => clearInterval(id);
  }, [ready, st.enabled, runBot]);

  const hasChannel = Object.values(channelsOf(st)).some(Boolean);
  const openSettings = (tab: SettingsTab = "alerts") => { setSettingsTab(tab); setSettingsOpen(true); };
  const nextVoiceName = () => { const n = nextVoice(); speak("Welcome to Kitibwa, your AI trading assistant."); setVoiceName(n); };
  const testSound = () => { beep(); speak("Test signal. Gold, 5 minute chart. buy setup, C R T. Entry, 4139 point 4 0. This is only a test."); };

  const toggleBot = () => {
    setMsg("");
    if (st.enabled) { set({ enabled: false }); return; }
    if (!st.secret) { openSettings("alerts"); setMsg("Enter the bot password first. It is the BOT_SECRET you set in Cloudflare."); return; }
    if (!hasChannel) { openSettings("alerts"); setMsg("Fill in Telegram, WhatsApp or the webhook first, then send a test."); return; }
    if (!st.pairs.length || !st.timeframes.length || !st.strategies.length) { openSettings("strategy"); setMsg("Pick at least one pair, one timeframe and one strategy."); return; }
    if (window.confirm("Switch alerts ON?\n\nWhile this page is open, the bot will send every new setup to your Telegram / WhatsApp / webhook.")) set({ enabled: true });
  };

  const r = sc?.results[tfId];
  const act = r?.decision.action;
  const cls = act === "BUY" ? "up" : act === "SELL" ? "down" : "";
  const units = (id: string) => (id === "XAU_USD" ? `${st.unitsXau} oz` : id === "BTC_USD" ? `${st.unitsBtc} BTC` : `${st.units} units`);
  const failed = bot?.results?.filter((x) => x.ok === false).length ?? 0;

  const positions = r?.filled ?? [];
  const changes = positions.filter((x) => x.change).length;
  const otherFilled = sc ? Object.entries(sc.results).filter(([t]) => t !== tfId).flatMap(([t, x]) => (x.filled ?? []).map((f) => ({ t, f }))) : [];
  const totalOpen = positions.length + otherFilled.length;
  const totalChanges = changes + otherFilled.filter((x) => x.f.change).length;
  // Live watch for the AI assistant: the bot's own check says a running trade should be closed
  const watchList: Watch[] = positions.filter((x) => x.change?.action === "CLOSE_EARLY").map((x) => ({
    key: `${pair}|${tfId}|${x.strategy}|${x.dir}|${x.since}`,
    text: `${ins.label} ${tfId} ${x.dir} ${x.strategy}: close the trade early. ${x.change!.reason}`,
  }));
  const sessionTxt = r ? (r.closed ? "CLOSED" : !r.sessionOn ? "ANY TIME" : r.inSession ? "ACTIVE" : "OUT") : "...";

  return (
    <div className="dash">
      {/* HEADER: logo and the alerts switch (all other settings are in the floating settings drawer) */}
      <div className={`card hdr full ${st.enabled ? "armed" : ""}`}>
        <div className="hdrtop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ONLINE KITIBWA" className="logo" />
        </div>
        <div className="hdrbar">
          <div className="switchrow">
            <button role="switch" aria-checked={st.enabled} aria-label="Alerts" className={`switch ${st.enabled ? "on" : ""}`} onClick={toggleBot}><span /></button>
            <div>
              <div className="label">Alerts to Telegram / WhatsApp / webhook</div>
              <div className={`big sm ${st.enabled ? "up" : ""}`}>{st.enabled ? (busy ? "ON, scanning..." : "ON") : "OFF"}</div>
            </div>
          </div>
          <div className="small grow" style={{ marginTop: 0 }}>
            {st.enabled
              ? `Bot is watching ${st.pairs.length} pair(s) on ${st.timeframes.length} timeframe(s)${bot ? `, last run ${clock(bot.at)}` : ""}. Keep this page open.`
              : "Switch on to let the bot send every new setup and every order change to your channels. The bot never places orders itself."}
          </div>
          <div className="chips">
            {st.enabled && <button className="chip" onClick={runBot} disabled={busy}>Run now</button>}
          </div>
          {msg && <div className="warn full" style={{ width: "100%" }}>{msg}</div>}
        </div>
      </div>

      {/* PAIR + VOICE ALERTS */}
      <div className="picker full">
        <div className="chips" role="tablist" aria-label="Pair">
          {INSTRUMENTS.map((p) => (
            <button key={p.id} onClick={() => setPair(p.id)} className={`chip ${p.id === pair ? "on" : ""}`} aria-pressed={p.id === pair}>{p.label}</button>
          ))}
        </div>
        <div className="chips">
          <button onClick={toggleAlerts} className={`chip ${alertsOn ? "on" : ""}`} aria-pressed={alertsOn} title="Voice and sound alerts read only the timeframe selected below">{alertsOn ? `Voice ${tfId}: ON` : `Voice ${tfId}: OFF`}</button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="kpis full">
        <div className="card kpi pricek">
          <div className="label"><span className={`dot ${fail ? "bad" : ""}`} /> {fail ? "Reconnecting" : px?.demo ? "Not live" : "Live"} | {ins.label}</div>
          {px?.demo ? (
            <>
              <div className="big price" style={{ fontSize: 22, color: "var(--muted)" }}>NO LIVE PRICE</div>
              <div className="warn">The bot is on simulated data, so it has no real price. Use the TradingView chart for the real price. The bot needs a live price feed before it can send alerts.</div>
            </>
          ) : (
            <>
              <div className={`big price ${tick}`}>{px ? px.mid.toFixed(ins.show) : "..."}</div>
              {px && <div className="small" style={{ marginTop: 2 }}>Bid {px.bid.toFixed(ins.show)} | Ask {px.ask.toFixed(ins.show)} | live from Yahoo Finance</div>}
            </>
          )}
        </div>
        <div className={`card kpi ${act === "BUY" ? "buy" : act === "SELL" ? "sell" : ""}`}>
          <div className="label">Decision | {tfId}</div>
          <div className={`big ${cls}`}>{act ?? "..."}</div>
          <div className="small" style={{ marginTop: 2 }}>{r?.decision.why ?? "Scanning..."}</div>
        </div>
        <div className="card kpi">
          <div className="label">{r?.htf ?? tf.htf} bias</div>
          <div className="big">{r ? (r.bias ?? "NONE") : "..."}</div>
        </div>
        {r ? (
          <DxyCard dxy={r.dxy} used={sc?.dxy?.used ?? !!ins.dxy} live={sc?.dxy?.live ?? false} htf={r.htf} ltf={tf.id} label={ins.label} />
        ) : (
          <div className="card kpi dxy"><div className="label">DXY alignment</div><div className="big">...</div></div>
        )}
        <div className="card kpi half">
          <div className="label">Session</div>
          <div className="big">{sessionTxt}</div>
          <div className="small" style={{ marginTop: 2 }}>{ins.crypto ? "Bitcoin trades 24/7" : r?.sessionOn ? "London / New York (UTC)" : "Filter off above H1"}</div>
        </div>
        <div className={`card kpi half ${totalChanges ? "sell" : totalOpen ? "buy" : ""}`}>
          <div className="label">Running trades</div>
          <div className="big">{totalOpen}</div>
          <div className={`small ${totalChanges ? "down" : ""}`} style={{ marginTop: 2 }}>{totalChanges ? `${totalChanges} order change${totalChanges > 1 ? "s" : ""} proposed` : totalOpen ? "All on track" : "No trade running"}</div>
        </div>
      </div>

      {/* TIMEFRAMES */}
      <div className="card full">
        <div className="row">
          <div className="label">All timeframes scanned together | tap one to select it (voice reads only the selected one)</div>
          <div className="small right" style={{ marginTop: 0 }}>{sc ? `Updated ${clock(sc.at)}` : "Scanning..."}, every 15s</div>
        </div>
        <div className="tfgrid">
          {TIMEFRAMES.map((t) => {
            const x = sc?.results[t.id], a = x?.decision.action ?? "...", n = x?.pending.length ?? 0, nf = x?.filled?.length ?? 0;
            const warnN = (x?.filled ?? []).filter((y) => y.change).length;
            return (
              <button key={t.id} onClick={() => setTfId(t.id)} className={`tile ${t.id === tfId ? "on" : ""}`} aria-pressed={t.id === tfId}>
                <span className="tfname"><span className={`dot ${fail ? "bad" : ""}`} />{t.id}</span>
                <span className={`tact ${a === "BUY" ? "up" : a === "SELL" ? "down" : ""}`}>{a}</span>
                <span className="small" style={{ marginTop: 0 }}>{x ? `bias ${x.bias ?? "none"}` : ""}</span>
                {warnN > 0 && <span className="tag r">{warnN} CHANGE</span>}
                {nf > 0 && <span className="tag g">{nf} RUNNING</span>}
                {n > 0 && <span className="tag">{n} LIMIT</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="chips full" role="tablist" aria-label="View">
        <button role="tab" aria-selected={tab === "bot"} onClick={() => setTab("bot")} className={`chip ${tab === "bot" ? "on" : ""}`}>Dashboard</button>
        <button role="tab" aria-selected={tab === "pred"} onClick={() => setTab("pred")} className={`chip ${tab === "pred" ? "on" : ""}`}>Prediction</button>
      </div>

      {tab === "pred" && (
        <div className="full">
          <NewsPredict pair={pair} tfId={tfId} setTf={setTfId} show={ins.show} st={st} setNewsFilter={(v) => set({ newsFilter: v })} />
        </div>
      )}

      {tab === "bot" && (
        <>
          {/* CHART */}
          <div className="card chartcard">
            <div className="chartbar">
              <div className="label">{ins.label} | {tf.id} chart</div>
              <div className="small" style={{ marginTop: 0 }}>Bias {tf.htf} | confirmation {tf.ltf}</div>
            </div>
            <TradingViewChart symbol={ins.tv} interval={tf.tv} bg={th.bg} grid={th.grid} />
          </div>

          <div className="side">
            {/* RUNNING TRADES + AUTOMATIC ORDER CHANGES */}
            <div className="card panel">
              <div className="ptitle"><div className="label">Running trades | {tf.id}</div>{positions.length > 0 && <span className="count">{positions.length}</span>}</div>
              {fail && <div className="error">Could not reach the scanner. Retrying.</div>}
              {!r && !fail && <div className="small">Scanning...</div>}
              {sc?.error && <div className="error">{sc.error}</div>}
              {sc?.demo && <div className="warn">Bot is on simulated data, so signals are not real and NO alerts are sent. The chart is live, but the bot has no real price feed yet.</div>}
              {r && positions.length === 0 && <div className="small">No trade is running on {tf.id}. When a limit order is reached it appears here, and the bot manages it automatically: if it fails to reach the target, it proposes an order change with a warning reason.</div>}
              {positions.map((f, i) => <PositionCard key={`p${i}`} f={f} show={ins.show} pip={ins.pip} px={px && !px.demo ? px.mid : undefined} />)}
              {otherFilled.length > 0 && <div className="label" style={{ marginTop: 16 }}>Also running on other timeframes</div>}
              {otherFilled.map(({ t, f }, i) => (
                <button key={`o${t}${i}`} className="pendbtn" style={{ background: "none", border: 0, padding: 0 }} onClick={() => setTfId(t)}>
                  <PositionCard f={f} show={ins.show} pip={ins.pip} px={px && !px.demo ? px.mid : undefined} tf={t} />
                </button>
              ))}
            </div>

            {/* LIVE SETUPS + FORMING LIMIT ORDERS */}
            <div className="card panel">
              <div className="label">KITIBWA bot: CRT + CISD + MSNR/LIT | {tf.id}</div>
              {!r && <div className="small">Scanning...</div>}
              {r && r.setups.length === 0 && <div className="small">No live market setup on {tf.id} right now.</div>}
              {r?.setups.map((s, i) => (
                <div key={i} className={`card setup ${r.held.includes(`${s.strategy}|${s.dir}`) ? "held" : ""}`}>
                  <div className="row">
                    <div className={`big ${s.dir === "BUY" ? "up" : "down"}`} style={{ fontSize: 20, marginTop: 0 }}>{s.strategy}: {s.dir}</div>
                    {r.held.includes(`${s.strategy}|${s.dir}`) && <span className="tag r" title="The US Dollar Index does not agree, so no alert is sent">HELD: DXY</span>}
                  </div>
                  <div className="small">Entry {s.entry.toFixed(ins.show)} | SL {s.sl.toFixed(ins.show)} | TP {s.tp.toFixed(ins.show)} | RR {s.rr}</div>
                  <ul className="small">{s.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ))}
              {r && (
                <>
                  <div className="label" style={{ marginTop: 16 }}>Limit orders forming</div>
                  {r.pending.length === 0 && <div className="small">No structure forming on {tf.id} right now.</div>}
                  {r.pending.map((p, i) => <LimitCard key={i} p={p} show={ins.show} units={units(ins.id)} />)}
                </>
              )}
            </div>

            {/* Limit orders forming on the other timeframes */}
            {sc && Object.entries(sc.results).some(([t, x]) => t !== tfId && x.pending.length > 0) && (
              <div className="card panel">
                <div className="label">Also forming on other timeframes</div>
                {Object.entries(sc.results).filter(([t]) => t !== tfId).flatMap(([t, x]) =>
                  x.pending.map((p, i) => (
                    <button key={`${t}${i}`} className="card setup pendbtn" onClick={() => setTfId(t)}>
                      <span className={`${p.dir === "BUY" ? "up" : "down"}`}><b>{t}</b> {p.strategy} {p.dir} LIMIT</span>
                      <span className="small">Entry {p.entry.toFixed(ins.show)} | SL {p.sl.toFixed(ins.show)} | TP {p.tp.toFixed(ins.show)} | RR {p.rr}</span>
                    </button>
                  ))
                )}
              </div>
            )}

        {/* Bot activity */}
        {bot && (
          <div className="card panel">
            <div className="label">Bot activity</div>
            <div className="small">Last run {clock(bot.at)}{failed ? ` | ${failed} alert(s) failed` : ""}</div>
            {bot.error && <div className="error">{bot.error}</div>}
            {bot.skipped && <div className="small">{bot.skipped}</div>}
            <ul className="log">
              {bot.results?.map((x, i) => (
                <li key={i} className={x.ok === true ? "up" : x.ok === false ? "down" : "muted"}>
                  {x.skipped
                    ? `${x.instrument}: ${x.skipped}`
                    : `${x.instrument} ${x.tf} ${x.kind} ${x.dir} ${x.strategy} @ ${x.entry} (SL ${x.sl}, TP ${x.tp}): ${x.ok ? `alert sent (${x.sent})` : `failed${x.reason ? ` - ${x.reason}` : ""}`}`}
                </li>
              ))}
            </ul>
          </div>
        )}
          </div>
        </>
      )}

      {/* SETTINGS: floating button (bottom left) opens a drawer over the dashboard */}
      <SettingsButton open={settingsOpen} onClick={() => openSettings(settingsTab)} needsSetup={!st.secret || !hasChannel} />
      <SettingsDrawer
        open={settingsOpen} onClose={() => setSettingsOpen(false)} tab={settingsTab} setTab={setSettingsTab}
        st={st} set={set} reset={() => setSt({ ...DEFAULTS, secret: st.secret, telegramToken: st.telegramToken, telegramChat: st.telegramChat, whatsappPhone: st.whatsappPhone, whatsappKey: st.whatsappKey, webhookUrl: st.webhookUrl, webhookSecret: st.webhookSecret })}
        storeOk={storeOk} theme={theme} setTheme={setTheme} music={music} toggleMusic={toggleMusic}
        voiceName={voiceName} onNextVoice={nextVoiceName} onTestSound={testSound}
      />

      {/* AI ASSISTANT: one clean floating button, bottom right */}
      <Assistant pair={pair} tfId={tfId} secret={st.secret} openCount={totalOpen} watch={watchList} silentWatch={alertsOn} say={sayNow} warn={beepWarn} />
    </div>
  );
}
