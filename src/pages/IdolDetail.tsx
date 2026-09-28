import { useMemo, useState } from "react";
import { useStore } from "../store";
import { CATEGORIES, computeOvr, roleLabel } from "../engine/ovr";
import { OvrBadge, Panel, PhotoCard, StatBar } from "../components/ui";
import { navigate } from "../router";

export function IdolDetail({ id }: { id: number }) {
  const { idols, config, deleteIdol, isAdmin, ready } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const idol = idols.find((i) => i.id === id);
  const breakdown = useMemo(
    () => (idol ? computeOvr(idol, config) : null),
    [idol, config]
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Loading scouting sheet…</p>
      </div>
    );
  }

  if (!idol || !breakdown) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">This scouting sheet doesn't exist</p>
        <p className="mt-2 text-[14px] text-mist">
          The idol may have been removed from the database.
        </p>
        <a href="#/binder" className="mt-4 inline-block font-semibold text-punch">
          Back to the binder
        </a>
      </div>
    );
  }

  const facts: [string, string][] = [
    ["Real name", idol.realName ?? ""],
    ["Group", idol.group],
    ["Gender", idol.gender],
    ["Generation", `Gen ${idol.generation}`],
    ["Debut year", idol.debutYear ? String(idol.debutYear) : ""],
    ["Agency", idol.agency ?? ""],
  ].filter(([, v]) => v !== "") as [string, string][];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Left pane — the card and the person */}
        <div>
          <PhotoCard idol={idol} ovr={breakdown.ovr} />
          {isAdmin && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => navigate(`/edit/${idol.id}`)}
                className="flex-1 rounded-lg bg-ink px-3 py-2 text-[14px] font-semibold text-white hover:bg-ink/90"
              >
                Edit sheet
              </button>
              {confirming ? (
                <button
                  onClick={() =>
                    void deleteIdol(idol.id).then((msg) => {
                      if (msg) setRemoveError(msg);
                      else navigate("/binder");
                    })
                  }
                  className="rounded-lg bg-punch px-3 py-2 text-[14px] font-semibold text-white"
                >
                  Confirm removal
                </button>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-[14px] font-medium text-mist hover:text-punch"
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {removeError && (
            <p role="alert" className="mt-3 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
              {removeError}
            </p>
          )}

          <Panel className="mt-6" title="Biography">
            <p className="text-[14px] leading-relaxed text-mist">{idol.bio || "No notes yet."}</p>
          </Panel>

          <Panel className="mt-4" title="Profile">
            <dl className="space-y-2.5">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-[14px]">
                  <dt className="text-mist">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
              {idol.customFields.map((f) => (
                <div key={f.id} className="flex justify-between gap-4 text-[14px]">
                  <dt className="text-mist">{f.label}</dt>
                  <dd className="text-right font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        {/* Right pane — the numbers */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold">{idol.stageName}</h1>
              <p className="mt-1 text-[14px] text-mist">
                {idol.group} — {idol.roles.map((r, i) => `${i + 1}. ${roleLabel(r)}`).join(", ")}
              </p>
            </div>
            <OvrBadge ovr={breakdown.ovr} size="lg" />
          </div>

          {/* How the rating is built */}
          <Panel className="mt-6" title="How this rating is built">
            <div className="space-y-2">
              {breakdown.roleScores.map((r) => (
                <div key={r.roleId} className="flex items-center gap-3 text-[14px]">
                  <span className="w-36 shrink-0 font-medium">{roleLabel(r.roleId)}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-holo"
                      style={{ width: `${((r.score - 40) / 59) * 100}%` }}
                    />
                  </div>
                  <span className="tnum w-10 text-right font-semibold">
                    {r.score.toFixed(1)}
                  </span>
                  <span className="tnum w-14 text-right text-[13px] text-mist">
                    × {(r.weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3 text-[14px]">
              <span>
                Role-weighted base{" "}
                <strong className="tnum">{breakdown.base.toFixed(1)}</strong>
              </span>
              <span>
                Popularity drift{" "}
                <strong className="tnum">
                  {breakdown.drift >= 0 ? "+" : ""}
                  {breakdown.drift.toFixed(1)}
                </strong>
              </span>
              <span>
                Overall <strong className="tnum">{breakdown.ovr}</strong>
              </span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-mist">
              Roles are ranked by this idol's actual scores, then blended with decay
              weights — the strongest role carries the rating, extra roles refine it.
            </p>
          </Panel>

          {/* Categories + atomic breakdown */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <Panel key={cat.key}>
                <StatBar label={cat.label} value={breakdown.cats[cat.key]} strong />
                <div className="mt-4 space-y-3">
                  {cat.subs.map((s) => (
                    <StatBar key={s.key} label={s.label} value={idol.attrs[s.key] ?? 50} />
                  ))}
                </div>
              </Panel>
            ))}
            <Panel>
              <StatBar label="Popularity" value={idol.popularity} strong />
              <p className="mt-4 text-[12px] leading-relaxed text-mist">
                Popularity is measured in points from 0 to 100 and never dominates:
                it drifts the overall rating by at most ±{config.driftMax} points.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
