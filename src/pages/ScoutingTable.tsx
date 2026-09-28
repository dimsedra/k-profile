import { useMemo, useState } from "react";
import { useStore } from "../store";
import { computeOvr, roleLabel, ROLES, type CategoryKey, type Idol } from "../engine/ovr";
import { OvrBadge, Portrait } from "../components/ui";
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

function statTone(v: number) {
  const r = Math.round(v);
  if (r >= 90) return "text-punch font-semibold";
  if (r >= 80) return "text-holo font-semibold";
  if (r < 65) return "text-mist";
  return "";
}

export function ScoutingTable() {
  const { idols, config, ready } = useStore();
  const [gender, setGender] = useState<"All" | "Male" | "Female">("All");
  const [gen, setGen] = useState<"All" | 1 | 2 | 3 | 4 | 5>("All");
  const [role, setRole] = useState("All");
  const [sorts, setSorts] = useState<SortSpec[]>([{ key: "ovr", dir: -1 }]);

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
    if (gender !== "All") out = out.filter((r) => r.idol.gender === gender);
    if (gen !== "All") out = out.filter((r) => r.idol.generation === gen);
    if (role !== "All") out = out.filter((r) => r.idol.roles.includes(role));
    return [...out].sort((a, b) => {
      for (const s of sorts) {
        const va = valueOf(a, s.key);
        const vb = valueOf(b, s.key);
        if (va < vb) return -1 * s.dir;
        if (va > vb) return 1 * s.dir;
      }
      return 0;
    });
  }, [rows, gender, gen, role, sorts]);

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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="py-20 text-center font-display font-semibold">Loading scouting table…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Scouting table</h1>
          <p className="mt-1 text-[13px] text-mist">
            Click a column to sort. Shift-click adds a secondary sort. Click a row to open the full sheet.
          </p>
        </div>
        <p className="tnum text-[13px] text-mist">
          {visible.length} of {rows.length} idols shown
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={gender}
          options={["All", "Male", "Female"] as const}
          onChange={setGender}
          name="Gender"
        />
        <Segmented
          value={gen}
          options={["All", 1, 2, 3, 4, 5] as const}
          onChange={setGen}
          name="Generation"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[14px] font-medium"
        >
          <option value="All">Every role</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
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
                <td className="tnum px-3 py-2 text-right">{row.idol.popularity}</td>
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

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  name,
}: {
  value: T | "All";
  options: readonly (T | "All")[];
  onChange: (v: any) => void;
  name: string;
}) {
  return (
    <div
      role="group"
      aria-label={name}
      className="flex rounded-lg border border-line bg-paper p-0.5"
    >
      {options.map((opt) => (
        <button
          key={String(opt)}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
            value === opt ? "bg-ink text-white" : "text-mist hover:text-ink"
          )}
        >
          {String(opt)}
        </button>
      ))}
    </div>
  );
}
