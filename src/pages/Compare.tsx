import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { Panel, PentagonChart, PhotoCard, Portrait, SearchInput, statTone } from "../components/ui";
import { computeOvr, CATEGORIES, roleLabel } from "../engine/ovr";
import { navigate } from "../router";
import { cn } from "../utils/cn";
import type { Idol } from "../engine/ovr";

export function Compare({ a, b }: { a?: string; b?: string }) {
  const { idols, config, ready } = useStore();
  const idolA = idols.find((i) => String(i.id) === a);
  const idolB = idols.find((i) => String(i.id) === b);

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="py-20 text-center font-display font-semibold">Loading comparison…</p>
      </div>
    );
  }

  const sameIds = !!a && !!b && a === b;
  const showStats = !!idolA && !!idolB && !sameIds;
  const breakA = idolA ? computeOvr(idolA, config) : null;
  const breakB = idolB ? computeOvr(idolB, config) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Compare idols</h1>
      <p className="mt-1 text-[13px] text-mist">
        Pick two idols to line up their stats side by side.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <IdolSlot
          label="Idol A"
          idol={idolA}
          excludeId={idolB?.id}
          missingNotice={a && !idolA ? "Couldn't find that idol — pick another." : undefined}
          onPick={(id) => navigate(`/compare/${id}/${b ?? ""}`)}
        />
        <IdolSlot
          label="Idol B"
          idol={idolB}
          excludeId={idolA?.id}
          missingNotice={b && !idolB ? "Couldn't find that idol — pick another." : undefined}
          onPick={(id) => navigate(a ? `/compare/${a}/${id}` : `/compare/${id}/`)}
        />
      </div>
      {sameIds && (
        <p role="alert" className="mt-4 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
          Pick two different idols to compare.
        </p>
      )}
      {showStats && idolA && idolB && breakA && breakB && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <PhotoCard idol={idolA} ovr={breakA.ovr} />
            <PhotoCard idol={idolB} ovr={breakB.ovr} />
          </div>
          <Panel title="Stats" className="mt-4">
            <VersusRow label="Overall rating" a={breakA.ovr} b={breakB.ovr} strong />
            <div className="mt-3 flex flex-col items-center border-t border-line pt-3">
              <PentagonChart values={breakA.cats} valuesB={breakB.cats} size={160} />
              <div className="mt-1 flex max-w-full items-center justify-center gap-4 text-[13px] text-mist">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-punch" />
                  <span className="truncate">{idolA.stageName}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-holo" />
                  <span className="truncate">{idolB.stageName}</span>
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-4">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="border-t border-line pt-3">
                  <VersusRow label={c.label} a={breakA.cats[c.key]} b={breakB.cats[c.key]} decimals={1} strong />
                  <div className="mt-2 space-y-2">
                    {c.subs.map((s) => (
                      <VersusRow
                        key={s.key}
                        label={s.label}
                        a={idolA.attrs[s.key] ?? 50}
                        b={idolB.attrs[s.key] ?? 50}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-line pt-3">
                <div className="grid min-h-10 grid-cols-[1fr_auto_1fr] items-center gap-x-3 text-[14px]">
                  <span className="truncate text-right font-medium">{roleLabel(idolA.roles[0] ?? "")}</span>
                  <span className="whitespace-nowrap px-1 text-[13px] text-mist">Primary role</span>
                  <span className="truncate text-left font-medium">{roleLabel(idolB.roles[0] ?? "")}</span>
                </div>
                <div className="mt-2">
                  <VersusRow label="Popularity" a={idolA.popularity} b={idolB.popularity} />
                </div>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function VersusRow({ label, a, b, decimals = 0, strong = false }: { label: string; a: number; b: number; decimals?: number; strong?: boolean }) {
  const d = a - b;
  const fmt = (v: number) => v.toFixed(decimals);
  return (
    <div className="grid min-h-10 grid-cols-[1fr_auto_1fr] items-center gap-x-3 text-[14px]">
      <span className={cn("tnum text-right font-semibold", strong ? "font-display text-lg font-bold" : "text-[15px]", d > 0 && statTone(a))}>
        {fmt(a)}
      </span>
      <span className="flex flex-col items-center px-1">
        <span className={cn("whitespace-nowrap", strong ? "font-display text-[15px] font-bold" : "text-[13px] text-mist")}>
          {label}
        </span>
        <span className="tnum text-[11px] text-mist/70">
          {d === 0 ? "—" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`}
        </span>
      </span>
      <span className={cn("tnum text-left font-semibold", strong ? "font-display text-lg font-bold" : "text-[15px]", d < 0 && statTone(b))}>
        {fmt(b)}
      </span>
    </div>
  );
}

function IdolSlot({
  label,
  idol,
  excludeId,
  missingNotice,
  onPick,
}: {
  label: string;
  idol: Idol | undefined;
  excludeId: number | undefined;
  missingNotice?: string;
  onPick: (id: number) => void;
}) {
  const { idols } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(!idol);

  useEffect(() => {
    setPicking(!idol);
    setQ("");
    setOpen(false);
  }, [idol?.id]);

  const query = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      idols
        .filter(
          (i) =>
            i.id !== excludeId &&
            (!query || i.stageName.toLowerCase().includes(query))
        )
        .slice(0, 6),
    [idols, excludeId, query]
  );

  if (idol && !picking) {
    return (
      <div className="rounded-xl border border-line bg-paper p-3">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-mist">{label}</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
            <Portrait idol={idol} className="h-full w-full" />
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">
            {idol.stageName}
          </span>
          <button
            onClick={() => setPicking(true)}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-mist">{label}</p>
      <div className="relative mt-2">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) {
              e.preventDefault();
              onPick(matches[0].id);
            } else if (e.key === "Escape") {
              setQ("");
              setOpen(false);
            }
          }}
          placeholder="Search idol…"
          ariaLabel={`Pick ${label}`}
          role="combobox"
          ariaExpanded={open}
          ariaControls={`compare-${label}-results`}
          dense
        />
        {open && (
          <ul
            id={`compare-${label}-results`}
            role="listbox"
            aria-label={`${label} results`}
            className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-60 overflow-auto rounded-xl border border-line bg-paper p-1.5 shadow-lg"
          >
            {matches.map((m) => (
              <li key={m.id} role="option" aria-selected={false}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(m.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-sleeve"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                    <Portrait idol={m} className="h-full w-full" />
                  </span>
                  <span className="truncate font-display text-[14px] font-semibold">
                    {m.stageName}
                  </span>
                  <span className="truncate text-[12px] text-mist">{m.group}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-6 text-center text-[13px] text-mist">
                No matches for “{q.trim()}”.
              </li>
            )}
          </ul>
        )}
      </div>
      {missingNotice && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-punch">
          {missingNotice}
        </p>
      )}
    </div>
  );
}
