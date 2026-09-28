import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import {
  CATEGORIES,
  ROLES,
  roleLabel,
  type CategoryKey,
} from "../engine/ovr";
import { Panel } from "../components/ui";
import { cn } from "../utils/cn";

export function Settings() {
  const {
    config, setConfig, resetConfig,
    fieldDefs, addFieldDef, deleteFieldDef, isAdmin,
  } = useStore();
  const [activeRole, setActiveRole] = useState(ROLES[0].id);
  const [saveError, setSaveError] = useState("");
  const [newField, setNewField] = useState("");

  const guard = () => {
    if (!isAdmin) {
      setSaveError("Sign in as admin to change the engine.");
      return false;
    }
    setSaveError("");
    return true;
  };

  /* ----- zero-sum shares: every group always totals exactly 100% ------ */
  /* Sliders move a local draft instantly (fully dynamic thumbs); the draft  */
  /* persists to Supabase 600 ms after the last change (no per-pixel writes). */

  type Shares = Record<string, number>;

  const subGroup = (cat: CategoryKey) => `sub:${cat}`;
  const roleGroup = (roleId: string) => `role:${roleId}`;

  /** Rebuild the fixed 5-category record from loose share data. */
  const toCatRecord = (g: Shares): Record<CategoryKey, number> => ({
    vocal: g.vocal ?? 0,
    rap: g.rap ?? 0,
    dance: g.dance ?? 0,
    stage: g.stage ?? 0,
    visual: g.visual ?? 0,
  });

  /** Scale any weight map to whole-percent shares totalling exactly 100. */
  const normalizeShares = (vals: Record<string, number>): Shares => {
    const keys = Object.keys(vals);
    if (keys.length === 0) return {};
    const total = keys.reduce((s, k) => s + (vals[k] ?? 0), 0);
    if (total <= 0) {
      // Degenerate (all zero): split evenly so sliders stay usable.
      const each = Math.floor(100 / keys.length);
      const out: Shares = {};
      let rest = 100;
      keys.forEach((k, i) => {
        out[k] = i === keys.length - 1 ? rest : each;
        rest -= out[k];
      });
      return out;
    }
    const raws = keys.map((k) => ((vals[k] ?? 0) / total) * 100);
    const floors = raws.map(Math.floor);
    let assigned = floors.reduce((s, f) => s + f, 0);
    const order = raws
      .map((r, i) => ({ i, frac: r - floors[i] }))
      .sort((a, b) => b.frac - a.frac);
    let k = 0;
    while (assigned < 100) {
      floors[order[k % order.length].i] += 1;
      assigned += 1;
      k += 1;
    }
    return Object.fromEntries(keys.map((key, i) => [key, floors[i]]));
  };

  const buildLocal = (cfg: typeof config): Record<string, Shares> => {
    const out: Record<string, Shares> = {};
    for (const cat of CATEGORIES)
      out[subGroup(cat.key)] = normalizeShares(cfg.subWeights[cat.key] ?? {});
    for (const r of ROLES)
      out[roleGroup(r.id)] = normalizeShares(cfg.roleMatrix[r.id] ?? {});
    return out;
  };

  const [local, setLocal] = useState<Record<string, Shares> | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRef = useRef<Record<string, Shares> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    localRef.current = local;
  }, [local]);

  // External config changes (load, reset, another tab) re-sync the draft —
  // but never while the user is mid-drag.
  useEffect(() => {
    if (!dirtyRef.current) setLocal(buildLocal(config));
  }, [config]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  /** Canonical keys for a group; used to self-heal malformed data. */
  const canonicalKeys = (group: string): string[] | null => {
    if (group.startsWith("sub:")) {
      const cat = CATEGORIES.find((c) => subGroup(c.key) === group);
      return cat ? cat.subs.map((s) => s.key) : null;
    }
    if (group.startsWith("role:")) {
      return ROLES.some((r) => roleGroup(r.id) === group)
        ? ["vocal", "rap", "dance", "stage", "visual"]
        : null;
    }
    return null;
  };

  const groupKeysOk = (group: string, g: Shares): boolean => {
    const canon = canonicalKeys(group);
    return (
      !!canon &&
      Object.keys(g).length === canon.length &&
      canon.every((k) => typeof g[k] === "number")
    );
  };

  const persistShares = (next: Record<string, Shares>) => {
    const base = configRef.current;
    const subWeights = { ...base.subWeights };
    for (const cat of CATEGORIES) {
      const g = next[subGroup(cat.key)];
      // Never persist a malformed group — this is what once poisoned the DB.
      if (g && groupKeysOk(subGroup(cat.key), g)) subWeights[cat.key] = { ...g };
    }
    const roleMatrix = { ...base.roleMatrix };
    for (const r of ROLES) {
      const g = next[roleGroup(r.id)];
      if (g && groupKeysOk(roleGroup(r.id), g)) roleMatrix[r.id] = toCatRecord(g);
    }
    void setConfig({ ...base, subWeights, roleMatrix }).then((msg) => {
      if (msg) {
        setSaveError(msg);
        dirtyRef.current = false;
        setLocal(buildLocal(configRef.current));
      }
    });
  };

  /** Set one share; the remainder is redistributed proportionally. */
  const setShare = (group: string, key: string, v: number) => {
    if (!guard()) return;
    v = Math.max(0, Math.min(100, Math.round(v)));
    setLocal((prev) => {
      const base = prev ?? buildLocal(configRef.current);
      let cur = base[group] ?? {};
      let keys = Object.keys(cur);
      if (!keys.includes(key)) {
        // Shape mismatch (e.g. a malformed row): rebuild the group with
        // canonical keys and an even split instead of ignoring the drag.
        const canon = canonicalKeys(group);
        if (!canon || canon.length < 2 || !canon.includes(key)) return base;
        const each = 100 / canon.length;
        cur = Object.fromEntries(canon.map((k) => [k, each]));
        keys = canon;
      }
      const others = keys.filter((k) => k !== key);
      const rest = 100 - v;
      const sumOthers = others.reduce((s, k) => s + cur[k], 0);
      const raws = others.map((k) =>
        sumOthers > 0 ? (cur[k] / sumOthers) * rest : rest / others.length
      );
      // Largest remainder: floors first, leftover points to biggest fractions.
      const floors = raws.map(Math.floor);
      let assigned = v + floors.reduce((s, f) => s + f, 0);
      const order = raws
        .map((r, i) => ({ i, frac: r - floors[i] }))
        .sort((a, b) => b.frac - a.frac);
      let k = 0;
      while (assigned < 100 && order.length > 0) {
        floors[order[k % order.length].i] += 1;
        assigned += 1;
        k += 1;
      }
      const out: Shares = { [key]: v };
      others.forEach((k2, i) => {
        out[k2] = floors[i];
      });
      return { ...base, [group]: out };
    });
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dirtyRef.current = false;
      if (localRef.current) persistShares(localRef.current);
    }, 600);
  };

  const sharesOf = (group: string): Shares =>
    (local ?? buildLocal(configRef.current))[group] ?? {};

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Rating engine</h1>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-mist">
            Every group of weights always totals 100% — push one slider up
            and the rest slide down automatically. Changes save on pause and
            apply to the whole database immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!guard()) return;
              void resetConfig().then((msg) => msg && setSaveError(msg));
            }}
            disabled={!isAdmin}
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink disabled:opacity-50"
          >
            Reset weights to defaults
          </button>
        </div>
      </div>
      {!isAdmin && (
        <p className="mt-4 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
          Read-only — <a href="#/login" className="underline">sign in as admin</a> to tune the engine.
        </p>
      )}
      {saveError && (
        <p role="alert" className="mt-4 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
          {saveError}
        </p>
      )}

      {/* Custom fields — one global set for every idol */}
      <h2 className="mt-10 font-display text-[16px] font-semibold">
        Custom profile fields
      </h2>
      <p className="mt-1 text-[13px] text-mist">
        These fields appear on every idol sheet. Values are filled per idol in the form.
      </p>
      <div className="mt-4 max-w-md">
        <Panel>
          {fieldDefs.length === 0 ? (
            <p className="text-[13px] text-mist">No custom fields yet.</p>
          ) : (
            <ul className="space-y-2">
              {fieldDefs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg bg-sleeve px-3 py-2">
                  <span className="text-[14px] font-medium">{d.label}</span>
                  {isAdmin && (
                    <button
                      onClick={() => void deleteFieldDef(d.id).then((msg) => msg && setSaveError(msg))}
                      aria-label={`Remove field ${d.label}`}
                      className="ml-auto rounded-md border border-line bg-paper px-2 py-0.5 text-[12px] text-mist hover:text-punch"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && (
            <div className="mt-3 flex gap-2">
              <input
                value={newField}
                onChange={(e) => setNewField(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newField.trim()) {
                    void addFieldDef(newField).then((msg) => {
                      if (msg) setSaveError(msg);
                      else setNewField("");
                    });
                  }
                }}
                placeholder="New field name, e.g. MBTI"
                aria-label="New custom field name"
                className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-[14px] placeholder:text-mist/60 focus:border-ink/40"
              />
              <button
                onClick={() =>
                  void addFieldDef(newField).then((msg) => {
                    if (msg) setSaveError(msg);
                    else setNewField("");
                  })
                }
                className="shrink-0 rounded-lg bg-punch/10 px-3 py-1.5 text-[13px] font-semibold text-punch hover:bg-punch hover:text-white"
              >
                + Add
              </button>
            </div>
          )}
        </Panel>
      </div>

      {/* Tier 1 — sub-attribute weights */}
      <h2 className="mt-10 font-display text-[16px] font-semibold">
        Tier 1 — attribute roll-up
      </h2>
      <p className="mt-1 text-[13px] text-mist">
        How much each atomic attribute counts inside its parent category.
        Each category always totals 100% — push one slider up and the rest
        slide down on their own.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const shares = sharesOf(subGroup(cat.key));
          return (
            <Panel key={cat.key} title={cat.label}>
              <div className="space-y-3">
                {cat.subs.map((sub) => {
                  const w = shares[sub.key] ?? 0;
                  return (
                    <div key={sub.key}>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <label htmlFor={`w-${sub.key}`} className="font-medium">
                          {sub.label}
                        </label>
                        <span className="tnum font-semibold">{w}%</span>
                      </div>
                      <input
                        id={`w-${sub.key}`}
                        type="range" min={0} max={100} value={w}
                        disabled={!isAdmin}
                        onChange={(e) => setShare(subGroup(cat.key), sub.key, Number(e.target.value))}
                        className="mt-0.5 w-full disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Tier 2 — role matrix + decay */}
      <h2 className="mt-10 font-display text-[16px] font-semibold">
        Tier 2 — role archetypes & ranked decay
      </h2>
      <p className="mt-1 text-[13px] text-mist">
        Each role weighs the five categories differently — and always totals
        100%. Roles are then ranked best-first per idol and blended with
        decay weights.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRole(r.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors",
                  activeRole === r.id
                    ? "bg-ink text-white"
                    : "bg-sleeve text-mist hover:text-ink"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {CATEGORIES.map((cat) => {
              const w = sharesOf(roleGroup(activeRole))[cat.key] ?? 0;
              return (
                <div key={cat.key} className="flex items-center gap-4">
                  <label
                    htmlFor={`rm-${cat.key}`}
                    className="w-32 shrink-0 text-[13px] font-medium"
                  >
                    {cat.label}
                  </label>
                  <input
                    id={`rm-${cat.key}`}
                    type="range" min={0} max={100} value={w}
                    disabled={!isAdmin}
                    onChange={(e) => setShare(roleGroup(activeRole), cat.key, Number(e.target.value))}
                    className="flex-1 disabled:opacity-40"
                  />
                  <span className="tnum w-12 text-right text-[13px] font-semibold">
                    {w}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[12px] text-mist">
            Editing the {roleLabel(activeRole)} archetype re-rates every idol holding that role.
          </p>
        </Panel>

        <Panel title="Ranked role decay">
          <div className="flex items-baseline justify-between text-[13px]">
            <label htmlFor="decay" className="font-medium">Decay factor</label>
            <span className="tnum font-semibold">{config.roleDecay.toFixed(2)}</span>
          </div>
          <input
            id="decay" type="range" min={0.25} max={0.85} step={0.05}
            value={config.roleDecay}
            disabled={!isAdmin}
            onChange={(e) => {
              if (!guard()) return;
              void setConfig({ ...config, roleDecay: Number(e.target.value) })
                .then((msg) => msg && setSaveError(msg));
            }}
            className="mt-1 w-full disabled:opacity-40"
          />
          <p className="mt-2 text-[12px] leading-relaxed text-mist">
            Each further role counts {Math.round(config.roleDecay * 100)}% as much
            as the one above it, then weights are normalized. Low values favor
            pure specialists; high values reward genuine all-rounders. Because the
            blend is normalized and roles are ranked by measured score, stacking
            weak roles can only lower a rating — never inflate it.
          </p>
          <div className="mt-4 space-y-1.5">
            {[0, 1, 2].map((i) => {
              const raw = [0, 1, 2].map((j) => Math.pow(config.roleDecay, j));
              const total = raw.reduce((s, v) => s + v, 0);
              return (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="tnum w-12 text-mist">Role {i + 1}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-holo"
                      style={{ width: `${(raw[i] / total) * 100}%` }}
                    />
                  </div>
                  <span className="tnum w-10 text-right text-mist">
                    {Math.round((raw[i] / total) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Tier 3 — drift */}
      <h2 className="mt-10 font-display text-[16px] font-semibold">
        Tier 3 — popularity drift
      </h2>
      <div className="mt-4 max-w-md">
        <Panel>
          <div className="flex items-baseline justify-between text-[13px]">
            <label htmlFor="drift" className="font-medium">Maximum drift</label>
            <span className="tnum font-semibold">±{config.driftMax.toFixed(1)} pts</span>
          </div>
          <input
            id="drift" type="range" min={0} max={4} step={0.5}
            value={config.driftMax}
            disabled={!isAdmin}
            onChange={(e) => {
              if (!guard()) return;
              void setConfig({ ...config, driftMax: Number(e.target.value) })
                .then((msg) => msg && setSaveError(msg));
            }}
            className="mt-1 w-full disabled:opacity-40"
          />
          <p className="mt-2 text-[12px] leading-relaxed text-mist">
            Popularity of 50 pts is neutral. 100 pts adds the full bonus; 0 pts
            subtracts it. Set to 0 to rate on craft alone.
          </p>
        </Panel>
      </div>
    </div>
  );
}
