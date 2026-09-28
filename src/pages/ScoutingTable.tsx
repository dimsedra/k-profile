import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { computeOvr, roleLabel, ROLES, type CategoryKey, type Idol } from "../engine/ovr";
import { OvrBadge, Portrait, SearchInput, statTone } from "../components/ui";
import { navigate } from "../router";
import { cn } from "../utils/cn";

type Row = { idol: Idol; cats: Record<CategoryKey, number>; ovr: number };

type SortKey =
  | "name" | "group" | "gender" | "gen" | "role"
  | "vocal" | "rap" | "dance" | "stage" | "visual"
  | "pop" | "ovr";

interface SortSpec { key: SortKey; dir: 1 | -1 }

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Stage Name" },
  { key: "group", label: "Group" },
  { key: "gender", label: "Gender" },
  { key: "gen", label: "Gen", numeric: true },
  { key: "role", label: "Primary Role" },
  { key: "vocal", label: "Vocal", numeric: true },
  { key: "rap", label: "Rap", numeric: true },
  { key: "dance", label: "Dance", numeric: true },
  { key: "stage", label: "Stage Presence", numeric: true },
  { key: "visual", label: "Visual", numeric: true },
  { key: "pop", label: "Popularity (pts)", numeric: true },
  { key: "ovr", label: "OVR", numeric: true },
];

function valueOf(row: Row, key: SortKey): string | number {
  switch (key) {
    case "name": return row.idol.stageName.toLowerCase();
    case "group": return row.idol.group.toLowerCase();
    case "gender": return row.idol.gender;
    case "gen": return row.idol.generation;
    case "role": return roleLabel(row.idol.roles[0] ?? "");
    case "vocal": case "rap": case "dance": case "stage": case "visual":
      return row.cats[key];
    case "pop": return row.idol.popularity;
    case "ovr": return row.ovr;
  }
}

const CATEGORIES_KEYS = ["vocal", "rap", "dance", "stage", "visual"] as const;

interface TableFilters {
  genders: ("Male" | "Female")[];
  generations: number[];
  roles: string[];
  groups: string[];
  ovrMin: number | null;
  ovrMax: number | null;
  popMin: number | null;
  catMin: Record<CategoryKey, number | null>;
  search: string;
}

const EMPTY_FILTERS: TableFilters = {
  genders: [],
  generations: [],
  roles: [],
  groups: [],
  ovrMin: null,
  ovrMax: null,
  popMin: null,
  catMin: { vocal: null, rap: null, dance: null, stage: null, visual: null },
  search: "",
};

const toggleIn = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function ScoutingTable() {
  const { idols, config, ready, groups } = useStore();
  const [sorts, setSorts] = useState<SortSpec[]>([{ key: "ovr", dir: -1 }]);
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const rows = useMemo<Row[]>(
    () =>
      idols.map((idol) => {
        const b = computeOvr(idol, config);
        return { idol, cats: b.cats, ovr: b.ovr };
      }),
    [idols, config]
  );

  const visible = useMemo(() => {
    let out = rows;
    const sq = filters.search.trim().toLowerCase();
    if (sq)
      out = out.filter(
        (r) =>
          r.idol.stageName.toLowerCase().includes(sq) ||
          (r.idol.realName ?? "").toLowerCase().includes(sq) ||
          r.idol.group.toLowerCase().includes(sq)
      );
    if (filters.genders.length > 0) out = out.filter((r) => filters.genders.includes(r.idol.gender));
    if (filters.generations.length > 0)
      out = out.filter((r) => filters.generations.includes(r.idol.generation));
    if (filters.roles.length > 0)
      out = out.filter((r) => r.idol.roles.some((x) => filters.roles.includes(x)));
    if (filters.groups.length > 0) out = out.filter((r) => filters.groups.includes(r.idol.group));
    if (filters.ovrMin !== null) out = out.filter((r) => r.ovr >= (filters.ovrMin as number));
    if (filters.ovrMax !== null) out = out.filter((r) => r.ovr <= (filters.ovrMax as number));
    if (filters.popMin !== null)
      out = out.filter((r) => r.idol.popularity >= (filters.popMin as number));
    (CATEGORIES_KEYS as readonly CategoryKey[]).forEach((k) => {
      const m = filters.catMin[k];
      if (m !== null) out = out.filter((r) => Math.round(r.cats[k]) >= m);
    });
    return [...out].sort((a, b) => {
      for (const s of sorts) {
        const va = valueOf(a, s.key);
        const vb = valueOf(b, s.key);
        if (va < vb) return -1 * s.dir;
        if (va > vb) return 1 * s.dir;
      }
      return 0;
    });
  }, [rows, filters, sorts]);

  const activeFilterCount =
    (filters.genders.length > 0 ? 1 : 0) +
    (filters.generations.length > 0 ? 1 : 0) +
    (filters.roles.length > 0 ? 1 : 0) +
    (filters.groups.length > 0 ? 1 : 0) +
    (filters.ovrMin !== null || filters.ovrMax !== null ? 1 : 0) +
    (filters.popMin !== null ? 1 : 0) +
    (Object.values(filters.catMin).some((v) => v !== null) ? 1 : 0);

  const toggleSort = (key: SortKey, additive: boolean) => {
    setSorts((prev) => {
      const numeric = COLUMNS.find((c) => c.key === key)?.numeric;
      const initial: 1 | -1 = numeric ? -1 : 1;
      const existing = prev.find((s) => s.key === key);
      if (!additive) {
        if (existing && prev[0]?.key === key)
          return [{ key, dir: (existing.dir * -1) as 1 | -1 }];
        return [{ key, dir: existing?.dir ?? initial }];
      }
      if (existing)
        return prev.map((s) => (s.key === key ? { ...s, dir: (s.dir * -1) as 1 | -1 } : s));
      return [...prev, { key, dir: initial }];
    });
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="py-20 text-center font-display font-semibold">Loading scouting table…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Scouting table</h1>
          <p className="mt-1 text-[13px] text-mist">
            Click a column to sort. Shift-click adds a secondary sort. Click a row to open the full sheet.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <p className="tnum text-[13px] text-mist sm:text-right">
            {visible.length} of {rows.length} idols shown
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={filters.search}
              onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
              placeholder="Search name or group…"
              ariaLabel="Search table"
              className="w-full sm:w-64"
            />
            <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[14px] font-medium",
              activeFilterCount > 0
                ? "border-ink bg-ink text-white"
                : "border-line bg-paper text-mist hover:text-ink"
            )}
          >
            Filter{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
          {filterOpen && (
            <div
              role="dialog"
              aria-label="Table filters"
              className="absolute right-0 top-full z-50 mt-1.5 max-h-[70vh] w-80 space-y-4 overflow-auto rounded-xl border border-line bg-paper p-4 shadow-lg"
            >
              <FilterGroupSearch
                options={groups.map((g) => g.name)}
                selected={filters.groups}
                onToggle={(name) => setFilters((f) => ({ ...f, groups: toggleIn(f.groups, name) }))}
              />
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[13px] font-medium">OVR</span>
                <input
                  type="number" min={40} max={99} placeholder="Min" aria-label="Minimum OVR"
                  value={filters.ovrMin ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, ovrMin: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]"
                />
                <input
                  type="number" min={40} max={99} placeholder="Max" aria-label="Maximum OVR"
                  value={filters.ovrMax ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, ovrMax: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[13px] font-medium">Popularity ≥</span>
                <input
                  type="number" min={0} max={100} placeholder="0" aria-label="Minimum popularity"
                  value={filters.popMin ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, popMin: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]"
                />
              </div>
              {(Object.keys(filters.catMin) as CategoryKey[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[13px] font-medium capitalize">{k} ≥</span>
                  <input
                    type="number" min={40} max={99} placeholder="—" aria-label={`Minimum ${k}`}
                    value={filters.catMin[k] ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        catMin: { ...f.catMin, [k]: e.target.value === "" ? null : Number(e.target.value) },
                      }))
                    }
                    className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]"
                  />
                </div>
              ))}
              <div>
                <p className="mb-1.5 text-[13px] font-medium">Gender</p>
                <div className="flex gap-1.5">
                  {(["Male", "Female"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setFilters((f) => ({ ...f, genders: toggleIn(f.genders, g) }))}
                      className={cn(
                        "rounded-md px-3 py-1 text-[13px] font-medium",
                        filters.genders.includes(g)
                          ? "bg-ink text-white"
                          : "bg-sleeve text-mist hover:text-ink"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium">Generation</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((g) => (
                    <button
                      key={g}
                      onClick={() => setFilters((f) => ({ ...f, generations: toggleIn(f.generations, g) }))}
                      className={cn(
                        "rounded-md px-3 py-1 text-[13px] font-medium",
                        filters.generations.includes(g)
                          ? "bg-ink text-white"
                          : "bg-sleeve text-mist hover:text-ink"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium">Roles held</p>
                <div className="max-h-36 space-y-1 overflow-auto">
                  {ROLES.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={filters.roles.includes(r.id)}
                        onChange={() => setFilters((f) => ({ ...f, roles: toggleIn(f.roles, r.id) }))}
                        className="h-4 w-4"
                      />
                      <span className={filters.roles.includes(r.id) ? "font-medium" : "text-mist"}>
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="w-full rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-mist hover:text-punch"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[980px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-line">
              <th className="w-12 px-3 py-2.5" aria-label="Portrait" />
              {COLUMNS.map((col) => {
                const idx = sorts.findIndex((s) => s.key === col.key);
                const active = idx >= 0;
                return (
                  <th
                    key={col.key}
                    className={cn("px-3 py-2.5", col.numeric ? "text-right" : "text-left")}
                  >
                    <button
                      onClick={(e) => toggleSort(col.key, e.shiftKey)}
                      className={cn(
                        "inline-flex items-center gap-1 text-[13px] font-semibold",
                        active ? "text-punch" : "text-mist hover:text-ink"
                      )}
                    >
                      {col.label}
                      {active && (
                        <span className="tnum text-[11px]">
                          {sorts[idx].dir === 1 ? "▲" : "▼"}
                          {sorts.length > 1 && <sup>{idx + 1}</sup>}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.idol.id}
                onClick={() => navigate(`/idol/${row.idol.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/idol/${row.idol.id}`)}
                tabIndex={0}
                className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-sleeve/70"
              >
                <td className="px-3 py-2">
                  <div className="h-9 w-9 overflow-hidden rounded-lg">
                    <Portrait idol={row.idol} className="h-full w-full" />
                  </div>
                </td>
                <td className="px-3 py-2 font-semibold">{row.idol.stageName}</td>
                <td className="px-3 py-2 text-mist">{row.idol.group}</td>
                <td className="px-3 py-2 text-mist">{row.idol.gender}</td>
                <td className="tnum px-3 py-2 text-right text-mist">{row.idol.generation}</td>
                <td className="px-3 py-2">{roleLabel(row.idol.roles[0] ?? "")}</td>
                {(["vocal", "rap", "dance", "stage", "visual"] as const).map((k) => (
                  <td key={k} className={cn("tnum px-3 py-2 text-right", statTone(row.cats[k]))}>
                    {Math.round(row.cats[k])}
                  </td>
                ))}
                <td className={cn("tnum px-3 py-2 text-right", statTone(row.idol.popularity))}>{row.idol.popularity}</td>
                <td className="px-3 py-2 text-right">
                  <OvrBadge ovr={row.ovr} size="sm" />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-mist">
                  No idols match these filters. Widen the filters or{" "}
                  <a href="#/add" className="font-semibold text-punch">add an idol</a>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterGroupSearch({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const query = q.trim().toLowerCase();
  const matches = (query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options
  )
    .filter((o) => !selected.includes(o))
    .slice(0, 8);
  const hi = matches.length > 0 ? highlight % matches.length : 0;

  const pick = (name: string) => {
    onToggle(name);
    setQ("");
    setHighlight(0);
    setOpen(true);
  };

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium">Groups</p>
      {selected.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {selected.map((name) => (
            <button
              key={name}
              onClick={() => onToggle(name)}
              aria-label={`Remove ${name} filter`}
              className="rounded-md bg-ink px-2 py-0.5 text-[12px] font-medium text-white"
            >
              {name} ✕
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && matches.length > 0) {
              e.preventDefault();
              setHighlight((h) => (h + 1) % matches.length);
            } else if (e.key === "ArrowUp" && matches.length > 0) {
              e.preventDefault();
              setHighlight((h) => (h - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter" && open && matches.length > 0) {
              e.preventDefault();
              pick(matches[hi]);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          placeholder="Type to filter groups…"
          aria-label="Type to filter groups"
          role="combobox"
          aria-expanded={open}
          aria-controls="group-filter-suggest"
          autoComplete="off"
          className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px] placeholder:text-mist/60"
        />
        {open && (matches.length > 0 || query) && (
          <ul
            id="group-filter-suggest"
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-auto rounded-lg border border-line bg-paper py-1 shadow-lg"
          >
            {matches.map((name, i) => (
              <li
                key={name}
                role="option"
                aria-selected={i === hi}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(name);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={
                  i === hi
                    ? "cursor-pointer bg-sleeve px-3 py-1.5 text-[13px] font-medium"
                    : "cursor-pointer px-3 py-1.5 text-[13px] text-mist"
                }
              >
                {name}
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-2 text-[13px] text-mist">
                No groups match “{q.trim()}”.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
