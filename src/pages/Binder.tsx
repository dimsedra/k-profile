import { useMemo, useState } from "react";
import { useStore } from "../store";
import { ovrOf } from "../engine/ovr";
import { OvrBadge, PhotoCard, Portrait } from "../components/ui";
import { navigate } from "../router";

export function Binder() {
  const { idols, config, ready, groups, groupStats, groupMemberIds } = useStore();
  const [query, setQuery] = useState("");

  const cards = useMemo(
    () =>
      idols
        .map((idol) => ({ idol, ovr: ovrOf(idol, config) }))
        .sort((a, b) => b.ovr - a.ovr),
    [idols, config]
  );

  const q = query.trim().toLowerCase();
  const idolHits = q
    ? cards.filter(({ idol }) => idol.stageName.toLowerCase().includes(q)).slice(0, 8)
    : [];
  const groupHits = q
    ? groups
        .filter((g) => g.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((group) => ({
          group,
          stats: groupStats(group.id),
          count: groupMemberIds(group.id).length,
        }))
    : [];

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="py-20 text-center font-display font-semibold">Loading binder…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Photocard binder</h1>
          <p className="mt-1 text-[13px] text-mist">
            Sorted by overall rating. Cards rated 90+ get the holographic foil edge.
          </p>
        </div>
        <p className="tnum text-[13px] text-mist">{cards.length} cards</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          if (e.key === "Enter") {
            const first = [...groupHits, ...idolHits][0];
            if (first)
              navigate("group" in first ? `/group/${first.group.id}` : `/idol/${first.idol.id}`);
          }
        }}
        placeholder="Search idols or groups…"
        aria-label="Search idols or groups"
        className="mt-6 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-[15px] placeholder:text-mist/60 focus:border-ink/40"
      />

      {q ? (
        <ul role="listbox" aria-label="Search results" className="mt-6 space-y-2">
          {groupHits.map(({ group, stats, count }) => (
            <li key={`g-${group.id}`} role="option" aria-selected={false}>
              <button
                onClick={() => navigate(`/group/${group.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left hover:border-ink/30"
              >
                <span className="rounded-md bg-holo px-1.5 py-0.5 text-[11px] font-bold text-white">
                  Group
                </span>
                <span className="font-display text-[15px] font-semibold">{group.name}</span>
                <span className="tnum text-[13px] text-mist">{count} members</span>
                <span className="ml-auto">
                  {stats ? <OvrBadge ovr={stats.ovr} size="sm" /> : <span className="text-mist">—</span>}
                </span>
              </button>
            </li>
          ))}
          {idolHits.map(({ idol, ovr }) => (
            <li key={`i-${idol.id}`} role="option" aria-selected={false}>
              <button
                onClick={() => navigate(`/idol/${idol.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left hover:border-ink/30"
              >
                <span className="h-9 w-9 overflow-hidden rounded-lg">
                  <Portrait idol={idol} className="h-full w-full" />
                </span>
                <span className="font-display text-[15px] font-semibold">{idol.stageName}</span>
                <span className="text-[13px] text-mist">{idol.group}</span>
                <span className="ml-auto">
                  <OvrBadge ovr={ovr} size="sm" />
                </span>
              </button>
            </li>
          ))}
          {groupHits.length === 0 && idolHits.length === 0 && (
            <li className="px-4 py-12 text-center text-mist">
              No matches for “{query.trim()}”.
            </li>
          )}
        </ul>
      ) : cards.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-line bg-paper p-12 text-center">
          <p className="font-display font-semibold">The binder is empty</p>
          <p className="mt-2 text-[14px] text-mist">
            Add your first idol to print their card.
          </p>
          <a
            href="#/add"
            className="mt-5 inline-block rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white"
          >
            + Add Idol
          </a>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map(({ idol, ovr }) => (
            <PhotoCard key={idol.id} idol={idol} ovr={ovr} href={`#/idol/${idol.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
