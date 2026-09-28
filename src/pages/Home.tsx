import { useMemo } from "react";
import { useStore } from "../store";
import { CATEGORIES, computeOvr, ovrOf, roleLabel } from "../engine/ovr";
import { OvrBadge, PhotoCard, Portrait } from "../components/ui";

export function Home() {
  const { idols, config, ready, groups: groupList, groupStats, groupMemberIds } = useStore();

  const rated = useMemo(
    () =>
      idols
        .map((idol) => ({ idol, ovr: ovrOf(idol, config) }))
        .sort((a, b) => b.ovr - a.ovr),
    [idols, config]
  );

  const top = rated[0];
  const popular = useMemo(
    () =>
      [...rated].sort((a, b) => b.idol.popularity - a.idol.popularity)[0],
    [rated]
  );

  const groupCount = useMemo(
    () => new Set(idols.filter((i) => i.group !== "Solo").map((i) => i.group)).size,
    [idols]
  );
  const soloists = idols.filter((i) => i.group === "Solo").length;

  const topGroup = useMemo(() => {
    let best: { id: number; name: string; ovr: number; count: number } | null = null;
    for (const g of groupList) {
      const stats = groupStats(g.id);
      if (!stats) continue;
      const count = groupMemberIds(g.id).length;
      if (!best || stats.ovr > best.ovr) best = { id: g.id, name: g.name, ovr: stats.ovr, count };
    }
    return best;
  }, [groupList, groupStats, groupMemberIds]);

  const leaders = useMemo(
    () =>
      CATEGORIES.map((cat) => {
        let best: { idol: (typeof idols)[number]; value: number } | null = null;
        for (const idol of idols) {
          const v = computeOvr(idol, config).cats[cat.key];
          if (!best || v > best.value) best = { idol, value: v };
        }
        return { cat, best };
      }),
    [idols, config]
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Loading catalog…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Hero — the binder's best card is the opening image */}
      <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:gap-16">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-bold leading-[1.15] sm:text-4xl">
            Scout idols like
            <br />
            athletes. Keep them
            <br />
            like <span className="text-punch">photocards.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
            K-Profile keeps a scouting sheet on every idol you follow — twenty
            atomic attributes, ranked roles, and a three-tier overall rating —
            then prints it all onto a collectible card.
          </p>
          <dl className="mt-8 flex gap-10">
            <div>
              <dd className="font-display tnum text-3xl font-bold">{idols.length}</dd>
              <dt className="mt-1 text-[13px] text-mist">idols cataloged</dt>
            </div>
            <div>
              <dd className="font-display tnum text-3xl font-bold">{groupCount}</dd>
              <dt className="mt-1 text-[13px] text-mist">groups on file</dt>
            </div>
            {soloists > 0 && (
              <div>
                <dd className="font-display tnum text-3xl font-bold">{soloists}</dd>
                <dt className="mt-1 text-[13px] text-mist">soloists</dt>
              </div>
            )}
          </dl>
        </div>
        {top && (
          <div className="mx-auto w-56 shrink-0 sm:w-64 lg:mr-6">
            <PhotoCard idol={top.idol} ovr={top.ovr} href={`#/idol/${top.idol.id}`} settle />
          </div>
        )}
      </div>

      {/* Highlights */}
      {top && popular && (
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HighlightCard
            heading="Top performer"
            href={`#/idol/${top.idol.id}`}
            portrait={<Portrait idol={top.idol} className="h-full w-full" />}
            name={top.idol.stageName}
            sub={`${top.idol.group} — ${roleLabel(top.idol.roles[0] ?? "allRounder")}`}
            metric={<OvrBadge ovr={top.ovr} size="lg" />}
            metricLabel="overall rating"
          />
          {topGroup && (
            <HighlightCard
              heading="Top group"
              href={`#/group/${topGroup.id}`}
              portrait={
                <Portrait
                  idol={{
                    stageName: topGroup.name,
                    photo: groupList.find((g) => g.id === topGroup.id)?.photo,
                  }}
                  className="h-full w-full"
                />
              }
              name={topGroup.name}
              sub={`${topGroup.count} members`}
              metric={<OvrBadge ovr={topGroup.ovr} size="lg" />}
              metricLabel="group rating"
            />
          )}
          <HighlightCard
            heading="Fandom powerhouse"
            href={`#/idol/${popular.idol.id}`}
            portrait={<Portrait idol={popular.idol} className="h-full w-full" />}
            name={popular.idol.stageName}
            sub={`${popular.idol.group} — ${roleLabel(popular.idol.roles[0] ?? "allRounder")}`}
            metric={
              <span className="font-display tnum text-2xl font-bold text-punch">
                {popular.idol.popularity}
              </span>
            }
            metricLabel="popularity pts"
          />
        </div>
      )}

      {/* League leaders */}
      {leaders.some((l) => l.best) && (
        <div className="mt-14">
          <h2 className="font-display text-[16px] font-semibold">League leaders</h2>
          <p className="mt-1 text-[13px] text-mist">
            Best in each category, across the whole catalog.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {leaders.map(
              ({ cat, best }) =>
                best && (
                  <a
                    key={cat.key}
                    href={`#/idol/${best.idol.id}`}
                    className="rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-ink/30"
                  >
                    <p className="text-[13px] text-mist">{cat.label}</p>
                    <p className="mt-1 truncate font-display text-[15px] font-semibold">
                      {best.idol.stageName}
                    </p>
                    <p className="tnum mt-1 font-display text-2xl font-bold text-holo">
                      {Math.round(best.value)}
                    </p>
                  </a>
                )
            )}
          </div>
        </div>
      )}

      {/* Action hub */}
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile
          href="#/table"
          title="Scouting table"
          desc="Sort and filter the full database, column by column."
        />
        <ActionTile
          href="#/binder"
          title="Photocard binder"
          desc="Browse every idol as a collectible 2:3 card."
        />
        <ActionTile
          href="#/add"
          title="Add an idol"
          desc="New scouting sheet with a live rating preview."
        />
        <ActionTile
          href="#/settings"
          title="Rating engine"
          desc="Tune attribute weights, role matrices and drift."
        />
      </div>
    </div>
  );
}

function HighlightCard({
  heading,
  href,
  portrait,
  name,
  sub,
  metric,
  metricLabel,
}: {
  heading: string;
  href: string;
  portrait: React.ReactNode;
  name: string;
  sub: string;
  metric: React.ReactNode;
  metricLabel: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-ink/30"
    >
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg">{portrait}</div>
      <div className="min-w-0">
        <p className="text-[13px] text-mist">{heading}</p>
        <p className="mt-0.5 truncate font-display text-[15px] font-semibold">{name}</p>
        <p className="truncate text-[13px] text-mist">{sub}</p>
      </div>
      <div className="ml-auto text-right">
        {metric}
        <p className="mt-1 text-[12px] text-mist">{metricLabel}</p>
      </div>
    </a>
  );
}

function ActionTile({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-ink/30"
    >
      <p className="font-display text-[15px] font-semibold">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-mist">{desc}</p>
    </a>
  );
}
