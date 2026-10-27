// Small form controls shared by the settings drawer.
// Chip list where several can be on at once
export function Multi({ all, on, set, label }: { all: { id: string; label: string }[]; on: string[]; set: (v: string[]) => void; label: string }) {
  const flip = (id: string) => set(on.includes(id) ? on.filter((x) => x !== id) : [...on, id]);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="chips wrapchips">
        {all.map((a) => (
          <button key={a.id} onClick={() => flip(a.id)} className={`chip ${on.includes(a.id) ? "on" : ""}`} aria-pressed={on.includes(a.id)}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
export function NumField({ label, v, set, step = 1, hint }: { label: string; v: number; set: (n: number) => void; step?: number; hint?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input type="number" inputMode="decimal" value={v} step={step} onChange={(e) => set(Number(e.target.value))} />
      {hint && <span className="small">{hint}</span>}
    </label>
  );
}

// On/off row with a switch, used for filters in the settings drawer
export function ToggleRow({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="trow">
      <div>
        <div className="tlabel">{label}</div>
        {hint && <div className="small" style={{ marginTop: 2 }}>{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? "on" : ""}`} onClick={() => set(!on)}><span /></button>
    </div>
  );
}

// Titled block inside the drawer
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ssec">
      <h3 className="stitle">{title}</h3>
      {children}
    </section>
  );
}
