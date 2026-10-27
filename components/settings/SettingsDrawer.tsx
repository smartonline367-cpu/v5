"use client";

import { useEffect, useState } from "react";
import { INSTRUMENTS, TIMEFRAMES } from "@/lib/trading/config";
import { STRATEGIES, type BotSettings } from "@/lib/alerts/settings";
import { channelsOf } from "@/lib/alerts/notify";
import { THEMES, type ThemeId } from "@/lib/client/themes";
import { Multi, NumField, Section, ToggleRow } from "@/components/ui/Controls";

export type SettingsTab = "alerts" | "strategy" | "sizing" | "look";
const TABS: { id: SettingsTab; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "strategy", label: "Strategy" },
  { id: "sizing", label: "Trade size" },
  { id: "look", label: "Appearance" },
];

type Props = {
  open: boolean; onClose: () => void;
  tab: SettingsTab; setTab: (t: SettingsTab) => void;
  st: BotSettings; set: (patch: Partial<BotSettings>) => void; reset: () => void;
  storeOk: boolean;
  theme: ThemeId; setTheme: (t: ThemeId) => void;
  music: boolean; toggleMusic: () => void;
  voiceName: string; onNextVoice: () => void; onTestSound: () => void;
};

// Floating settings button. It is always on screen and opens the drawer on top of the dashboard.
export function SettingsButton({ open, onClick, needsSetup }: { open: boolean; onClick: () => void; needsSetup: boolean }) {
  return (
    <button className={`sfab ${open ? "open" : ""}`} onClick={onClick} aria-label="Open settings" aria-expanded={open} title="Settings">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      {needsSetup && !open && <span className="sfabdot" aria-hidden="true" />}
    </button>
  );
}

export default function SettingsDrawer(p: Props) {
  const { open, onClose, tab, setTab, st, set } = p;
  const [testMsg, setTestMsg] = useState("");

  // Close with Escape and stop the page behind from scrolling while the drawer is open
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const ch = channelsOf(st);
  const tgHalf = !ch.telegram && !!(st.telegramToken || st.telegramChat);
  const waHalf = !ch.whatsapp && !!(st.whatsappPhone || st.whatsappKey);
  const hasChannel = ch.telegram || ch.whatsapp || ch.webhook;

  const clearIds = () => {
    if (!window.confirm("Remove your Telegram, WhatsApp and webhook details from this browser?\n\nAlerts will switch off. Other people's browsers are not affected.")) return;
    set({ enabled: false, telegramToken: "", telegramChat: "", whatsappPhone: "", whatsappKey: "", webhookUrl: "", webhookSecret: "" });
    setTestMsg("Your alert IDs were removed from this browser.");
  };

  const sendTest = async () => {
    setTestMsg("");
    if (!st.secret) { setTestMsg("Enter the bot password first. It is the BOT_SECRET you set in Cloudflare."); return; }
    if (!hasChannel) { setTestMsg("Fill in Telegram, WhatsApp or the webhook first."); return; }
    setTestMsg("Sending...");
    try {
      const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json", "x-bot-secret": st.secret }, body: JSON.stringify({ settings: st, test: true }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string; channels?: { channel: string; ok: boolean; reason?: string }[] };
      if (!res.ok) { setTestMsg(j.error ?? "The test failed."); return; }
      setTestMsg((j.channels ?? []).map((c) => (c.ok ? `${c.channel}: sent` : `${c.channel}: FAILED (${c.reason ?? "unknown"})`)).join(" | "));
    } catch { setTestMsg("Could not reach the server."); }
  };

  return (
    <>
      <div className="sback" onClick={onClose} aria-hidden="true" />
      <aside className="sdrawer" role="dialog" aria-modal="true" aria-label="Bot settings">
        <header className="shead">
          <div>
            <div className="stitlebar">Settings</div>
            <div className="small" style={{ marginTop: 2 }}>Saved in this browser. Changes apply straight away.</div>
          </div>
          <button className="aiicon" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <nav className="stabs" role="tablist" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`stab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        <div className="sbody">
          {tab === "alerts" && (
            <>
              <Section title="Where alerts go">
                <div className="warn">
                  Type your own Telegram, WhatsApp or webhook details. They stay in this browser only, never on the server. Anyone else who opens this link types their own,
                  and you also need the bot password from whoever set up the bot.
                </div>
                {!p.storeOk && <div className="error">This browser is not allowing saving (private mode?). Your IDs will be lost when you close the page. Use a normal browser window.</div>}
                <div className="chips wrapchips" aria-label="Channel status">
                  <span className={`tag ${ch.telegram ? "g" : tgHalf ? "r" : ""}`}>Telegram: {ch.telegram ? "ready" : tgHalf ? "needs token and chat ID" : "not set"}</span>
                  <span className={`tag ${ch.whatsapp ? "g" : waHalf ? "r" : ""}`}>WhatsApp: {ch.whatsapp ? "ready" : waHalf ? "needs number and key" : "not set"}</span>
                  <span className={`tag ${ch.webhook ? "g" : ""}`}>Webhook: {ch.webhook ? "ready" : "not set"}</span>
                  <span className={`tag ${st.secret ? "g" : "r"}`}>Bot password: {st.secret ? "saved" : "missing"}</span>
                </div>
              </Section>
              <Section title="Telegram">
                <div className="fields">
                  <label className="field">
                    <span className="label">Bot token</span>
                    <input type="password" autoComplete="off" value={st.telegramToken} onChange={(e) => set({ telegramToken: e.target.value })} placeholder="123456:ABC..." />
                    <span className="small">Message @BotFather, send /newbot, copy the token</span>
                  </label>
                  <label className="field">
                    <span className="label">Chat ID</span>
                    <input autoComplete="off" value={st.telegramChat} onChange={(e) => set({ telegramChat: e.target.value })} placeholder="123456789" />
                    <span className="small">Press Start on your bot, then ask @userinfobot for your number</span>
                  </label>
                </div>
              </Section>
              <Section title="WhatsApp (CallMeBot)">
                <div className="fields">
                  <label className="field">
                    <span className="label">Number</span>
                    <input autoComplete="off" value={st.whatsappPhone} onChange={(e) => set({ whatsappPhone: e.target.value })} placeholder="9715xxxxxxxx" />
                    <span className="small">Country code, digits only</span>
                  </label>
                  <label className="field">
                    <span className="label">API key</span>
                    <input type="password" autoComplete="off" value={st.whatsappKey} onChange={(e) => set({ whatsappKey: e.target.value })} placeholder="from CallMeBot" />
                    <span className="small">Free key from callmebot.com</span>
                  </label>
                </div>
              </Section>
              <Section title="Webhook (execution bridge)">
                <div className="fields">
                  <label className="field">
                    <span className="label">URL</span>
                    <input autoComplete="off" value={st.webhookUrl} onChange={(e) => set({ webhookUrl: e.target.value })} placeholder="https://..." />
                    <span className="small">Each setup is POSTed here. Must be https.</span>
                  </label>
                  <label className="field">
                    <span className="label">Secret (optional)</span>
                    <input type="password" autoComplete="off" value={st.webhookSecret} onChange={(e) => set({ webhookSecret: e.target.value })} />
                    <span className="small">Sent as header x-webhook-secret</span>
                  </label>
                </div>
              </Section>
              <Section title="Access">
                <label className="field">
                  <span className="label">Bot password</span>
                  <input type="password" autoComplete="off" value={st.secret} onChange={(e) => set({ secret: e.target.value })} placeholder="BOT_SECRET" />
                  <span className="small">Same value as BOT_SECRET in Cloudflare</span>
                </label>
                <div className="chips wrapchips">
                  <button type="button" className="chip on" onClick={sendTest}>Send test alert</button>
                  <button type="button" className="chip" onClick={clearIds}>Remove my IDs from this browser</button>
                </div>
                {testMsg && <div className="small">{testMsg}</div>}
              </Section>
            </>
          )}

          {tab === "strategy" && (
            <>
              <Section title="What the bot watches">
                <Multi label="Pairs" all={INSTRUMENTS.map((i) => ({ id: i.id, label: i.label }))} on={st.pairs} set={(pairs) => set({ pairs })} />
                <Multi label="Timeframes" all={TIMEFRAMES.map((t) => ({ id: t.id, label: t.id }))} on={st.timeframes} set={(timeframes) => set({ timeframes })} />
                <Multi label="Strategies" all={STRATEGIES.map((s) => ({ id: s, label: s }))} on={st.strategies} set={(strategies) => set({ strategies })} />
              </Section>
              <Section title="Entry confirmation">
                <ToggleRow label="DXY alignment" on={st.dxyFilter} set={(dxyFilter) => set({ dxyFilter })}
                  hint="Only send a setup when the US Dollar Index agrees: gold, EUR, GBP and AUD need a weaker dollar to BUY, USD/JPY and USD/CAD need a stronger one. Not used for Bitcoin." />
                <ToggleRow label="London / New York hours" on={st.sessionFilter} set={(sessionFilter) => set({ sessionFilter })} hint="Intraday timeframes only. Not used for Bitcoin." />
                <ToggleRow label="Alert on forming limit orders" on={st.useLimit} set={(useLimit) => set({ useLimit })} hint="Also alert when structure is forming and price has not reached the entry yet." />
                <div className="fields">
                  <NumField label="Min risk:reward" v={st.minRR} set={(minRR) => set({ minRR })} step={0.1} hint="1 to 10" />
                  <NumField label="Limit order expiry (h)" v={st.limitHours} set={(limitHours) => set({ limitHours })} hint="Sent with the webhook" />
                </div>
              </Section>
              <Section title="News filter">
                <ToggleRow label="Stay out around news" on={st.newsFilter} set={(newsFilter) => set({ newsFilter })} hint="No new alerts around economic news for the pair's currencies." />
                <ToggleRow label="Include medium-impact news" on={st.newsImpact === "medium"} set={(v) => set({ newsImpact: v ? "medium" : "high" })} hint="Off = high impact (red folder) only." />
                <div className="fields">
                  <NumField label="Minutes before" v={st.newsBefore} set={(newsBefore) => set({ newsBefore })} hint="0 to 240" />
                  <NumField label="Minutes after" v={st.newsAfter} set={(newsAfter) => set({ newsAfter })} hint="0 to 240" />
                </div>
              </Section>
            </>
          )}

          {tab === "sizing" && (
            <Section title="Size sent with the webhook">
              <div className="fields">
                <NumField label="Forex (units)" v={st.units} set={(units) => set({ units })} step={100} hint="All forex pairs" />
                <NumField label="Gold (oz)" v={st.unitsXau} set={(unitsXau) => set({ unitsXau })} hint="XAU/USD" />
                <NumField label="Bitcoin (BTC)" v={st.unitsBtc} set={(unitsBtc) => set({ unitsBtc })} step={0.01} hint="0.0001 to 100" />
              </div>
              <div className="small">The bot never places orders itself. These sizes are only included in the webhook message for your execution bridge.</div>
            </Section>
          )}

          {tab === "look" && (
            <>
              <Section title="Colour design">
                <div className="themes" role="radiogroup" aria-label="Colour design">
                  {THEMES.map((t) => (
                    <button key={t.id} role="radio" aria-checked={t.id === p.theme} aria-label={t.name} title={t.name} className={`sw ${t.id} ${t.id === p.theme ? "on" : ""}`} onClick={() => p.setTheme(t.id)} />
                  ))}
                </div>
                <div className="small">{THEMES.find((t) => t.id === p.theme)?.name}</div>
              </Section>
              <Section title="Sound and voice">
                <ToggleRow label="Soft background music" on={p.music} set={p.toggleMusic} hint="Fades down while the assistant speaks." />
                <div className="chips wrapchips">
                  <button className="chip" onClick={p.onNextVoice} title="Cycle through the lady voices on this device">{p.voiceName ? `Voice: ${p.voiceName.replace(/^(Microsoft|Google)\s+/i, "").split(" ")[0]}` : "Change voice"}</button>
                  <button className="chip" onClick={p.onTestSound}>Test sound</button>
                </div>
              </Section>
            </>
          )}
        </div>

        <footer className="sfoot">
          <button className="chip" onClick={p.reset}>Reset to defaults</button>
          <button className="chip on" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </>
  );
}
