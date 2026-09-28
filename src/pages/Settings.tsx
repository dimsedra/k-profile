import { useState } from "react";
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
  const { config, setConfig, resetConfig, restoreSamples } = useStore();
  const [activeRole, setActiveRole] = useState(ROLES[0].id);
  const [restored, setRestored] = useState(false);

  const setSubWeight = (cat: CategoryKey, key: string, v: number) =>
    setConfig({
      ...config,
      subWeights: {
        ...config.subWeights,
        [cat]: { ...config.subWeights[cat], [key]: v },
      },
    });

  const setRoleWeight = (roleId: string, cat: CategoryKey, v: number) =>
    setConfig({
      ...config,
      roleMatrix: {
        ...config.roleMatrix,
        [roleId]: { ...config.roleMatrix[roleId], [cat]: v },
      },
    });

  const roleRow = config.roleMatrix[activeRole];
  const roleTotal = Object.values(roleRow).reduce((s, v) => s + v, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Rating engine</h1>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-mist">
            Every weight here is relative — the engine normalizes each group, so
            you set emphasis, not percentages. Changes apply to the whole
            database immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetConfig}
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink"
          >
            Reset weights to defaults
          </button>
          <button
            onClick={() => {
              restoreSamples();
              setRestored(true);
              setTimeout(() => setRestored(false), 2500);
            }}
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink"
          >
            {restored ? "Sample database restored" : "Restore sample database"}
          </button>
        </div>
      </div>

      {/* Tier 1 — sub-attribute weights */}
      <h2 className="mt-10 font-display text-[16px] font-semibold">
        Tier 1 — attribute roll-up
      </h2>
      <p className="mt-1 text-[13px] text-mist">
        How much each atomic attribute counts inside its parent category.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const weights = config.subWeights[cat.key];
          const total = cat.subs.reduce((s, sub) => s + (weights[sub.key] ?? 0), 0);
          return (
            <Panel key={cat.key} title={cat.label}>
              <div className="space-y-3">
                {cat.subs.map((sub) => {
                  const w = weights[sub.key] ?? 0;
                  return (
                    <div key={sub.key}>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <label htmlFor={`w-${sub.key}`} className="font-medium">
                          {sub.label}
                        </label>
                        <span className="tnum text-mist">
                          {total > 0 ? Math.round((w / total) * 100) : 0}%
                        </span>
                      </div>
                      <input
                        id={`w-${sub.key}`}
                        type="range" min={0} max={50} value={w}
                        onChange={(e) => setSubWeight(cat.key, sub.key, Number(e.target.value))}
                        className="mt-0.5 w-full"
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
        Each role weighs the five categories differently. Roles are then ranked
        best-first per idol and blended with decay weights.
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
              const w = roleRow[cat.key] ?? 0;
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
                    type="range" min={0} max={60} value={w}
                    onChange={(e) => setRoleWeight(activeRole, cat.key, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="tnum w-10 text-right text-[13px] text-mist">
                    {roleTotal > 0 ? Math.round((w / roleTotal) * 100) : 0}%
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
            onChange={(e) => setConfig({ ...config, roleDecay: Number(e.target.value) })}
            className="mt-1 w-full"
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
            onChange={(e) => setConfig({ ...config, driftMax: Number(e.target.value) })}
            className="mt-1 w-full"
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
