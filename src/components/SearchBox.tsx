import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { ovrOf } from "../engine/ovr";
import { OvrBadge, Portrait, SearchInput } from "./ui";
import { navigate } from "../router";

/**
 * Universal search: idols + groups in one mixed list (groups first),
 * usable from the navbar on every page.
 */
export function SearchBox() {
  const { idols, config, groups, groupStats, groupMemberIds } = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();

  const idolHits = useMemo(
    () =>
      q
        ? idols
            .map((idol) => ({ idol, ovr: ovrOf(idol, config) }))
            .filter(({ idol }) => idol.stageName.toLowerCase().includes(q))
            .slice(0, 6)
        : [],
    [q, idols, config]
  );

  const groupHits = useMemo(
    () =>
      q
        ? groups
            .filter((g) => g.name.toLowerCase().includes(q))
            .slice(0, 6)
            .map((group) => ({
              group,
              stats: groupStats(group.id),
              count: groupMemberIds(group.id).length,
            }))
        : [],
    [q, groups, groupStats, groupMemberIds]
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQuery("");
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const go = (href: string) => {
    setQuery("");
    setOpen(false);
    navigate(href);
  };

  const first =
    q && open ? [...groupHits, ...idolHits][0] : undefined;

  return (
    <div ref={boxRef} className="relative min-w-0">
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        onFocus={() => q && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && first) {
            e.preventDefault();
            go("group" in first ? `/group/${first.group.id}` : `/idol/${first.idol.id}`);
          }
        }}
        placeholder="Search idols or groups…"
        ariaLabel="Search idols or groups"
        role="combobox"
        ariaExpanded={open && !!q}
        ariaControls="global-search-results"
        dense
      />
      {open && q && (
        <ul
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-80 space-y-1 overflow-auto rounded-xl border border-line bg-paper p-1.5 shadow-lg"
        >
          {groupHits.map(({ group, stats, count }) => (
            <li key={`g-${group.id}`} role="option" aria-selected={false}>
              <button
                onClick={() => go(`/group/${group.id}`)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-sleeve"
              >
                <span className="rounded-md bg-holo px-1.5 py-0.5 text-[11px] font-bold text-white">
                  Group
                </span>
                <span className="truncate font-display text-[14px] font-semibold">
                  {group.name}
                </span>
                <span className="tnum shrink-0 text-[12px] text-mist">{count} members</span>
                <span className="ml-auto shrink-0">
                  {stats ? (
                    <OvrBadge ovr={stats.ovr} size="sm" />
                  ) : (
                    <span className="text-mist">—</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {idolHits.map(({ idol, ovr }) => (
            <li key={`i-${idol.id}`} role="option" aria-selected={false}>
              <button
                onClick={() => go(`/idol/${idol.id}`)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-sleeve"
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                  <Portrait idol={idol} className="h-full w-full" />
                </span>
                <span className="truncate font-display text-[14px] font-semibold">
                  {idol.stageName}
                </span>
                <span className="truncate text-[12px] text-mist">{idol.group}</span>
                <span className="ml-auto shrink-0">
                  <OvrBadge ovr={ovr} size="sm" />
                </span>
              </button>
            </li>
          ))}
          {groupHits.length === 0 && idolHits.length === 0 && (
            <li className="px-3 py-6 text-center text-[13px] text-mist">
              No matches for “{query.trim()}”.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
