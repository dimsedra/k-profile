import { useMemo, useState } from "react";
import { useStore } from "../store";
import { CATEGORIES, computeOvr, roleLabel } from "../engine/ovr";
import { OvrBadge, Panel, PentagonChart, PhotoCard, StatBar, statTone } from "../components/ui";
import { navigate } from "../router";
import { cn } from "../utils/cn";

export function IdolDetail({ id }: { id: number }) {
  const { idols, groups, config, deleteIdol, isAdmin, ready } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const idol = idols.find((i) => i.id === id);
  const breakdown = useMemo(
    () => (idol ? computeOvr(idol, config) : null),
    [idol, config]
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Loading scouting sheet…</p>
      </div>
    );
  }

  if (!idol || !breakdown) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
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

  const groupId = groups.find(
    (g) => g.name.toLowerCase() === idol.group.toLowerCase()
  )?.id;

  // Uniform compact header for every idol: no per-name conditions,
  // nothing truncates.
  const subText = `${idol.group} — ${idol.roles.map((r, i) => `${i + 1}. ${roleLabel(r)}`).join(", ")}`;

  const facts: [string, string][] = [
    ["Real name", idol.realName ?? ""],
    ["Group", idol.group],
    ["Gender", idol.gender],
    ["Generation", `Gen ${idol.generation}`],
    ["Debut year", idol.debutYear ? String(idol.debutYear) : ""],
    ["Agency", idol.agency ?? ""],
  ].filter(([, v]) => v !== "") as [string, string][];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Left pane — the card and the person */}
        <div className="min-w-0">
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
                  <dt className="shrink-0 text-mist">{k}</dt>
                  <dd className="min-w-0 break-words text-right font-medium">
                    {k === "Group" && groupId !== undefined ? (
                      <a href={`#/group/${groupId}`} className="text-punch hover:underline">
                        {v}
                      </a>
                    ) : (
                      v
                    )}
                  </dd>
                </div>
              ))}
              {idol.customFields.map((f) => (
                <div key={f.id} className="flex justify-between gap-4 text-[14px]">
                  <dt className="shrink-0 text-mist">{f.label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        {/* Right pane — the numbers */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[29px] font-extrabold leading-none sm:text-5xl">
                {idol.stageName}
              </h1>
              <p className="mt-2 truncate text-[12px] text-mist sm:text-[14px]">
                {subText}
              </p>
            </div>
            <OvrBadge ovr={breakdown.ovr} size="lg" className="shrink-0 shadow-sm" />
          </div>
          <button
            onClick={() => navigate(`/compare/${idol.id}/`)}
            className="mt-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] font-semibold text-mist hover:text-ink"
          >
            Compare this idol
          </button>

          {/* How the rating is built + attribute pentagon */}
          <div className="mt-6 grid gap-4 xl:grid-cols-[260px_1fr]">
            <Panel>
              <PentagonChart values={breakdown.cats} />
            </Panel>
            <Panel title="How this rating is built">
            <div className="space-y-3">
              {breakdown.roleScores.map((r) => (
                <div key={r.roleId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px]">
                  <span className="order-1 w-28 shrink-0 truncate font-medium sm:w-36">{roleLabel(r.roleId)}</span>
                  <span className={cn("tnum order-2 ml-auto w-10 text-right font-semibold sm:ml-0", statTone(r.score))}>
                    {r.score.toFixed(1)}
                  </span>
                  <span className="tnum order-3 w-14 text-right text-[13px] text-mist">
                    × {(r.weight * 100).toFixed(0)}%
                  </span>
                  <div className="order-4 h-1 basis-full rounded-full bg-line sm:order-2 sm:basis-auto sm:flex-1">
                    <div
                      className="h-full rounded-full bg-holo"
                      style={{ width: `${((r.score - 40) / 59) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3 text-[14px]">
              <span>
                Role-weighted base{" "}
                <strong className={cn("tnum", statTone(breakdown.base))}>{breakdown.base.toFixed(1)}</strong>
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
          </div>

          {/* Categories + atomic breakdown */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <Panel key={cat.key}>
                <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
                  <span className="font-display text-[17px] font-bold">{cat.label}</span>
                  <span className={cn("font-display tnum text-2xl font-bold", statTone(breakdown.cats[cat.key]))}>
                    {Math.round(breakdown.cats[cat.key])}
                  </span>
                </div>
                <div className="space-y-3">
                  {cat.subs.map((s) => (
                    <StatBar key={s.key} label={s.label} value={idol.attrs[s.key] ?? 50} />
                  ))}
                </div>
              </Panel>
            ))}
            <Panel>
              <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
                <span className="font-display text-[17px] font-bold">Popularity</span>
                <span className={cn("font-display tnum text-2xl font-bold", statTone(idol.popularity))}>
                  {idol.popularity}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-mist">
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
