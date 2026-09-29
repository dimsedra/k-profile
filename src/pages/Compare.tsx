import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { OvrBadge, Panel, PhotoCard, Portrait, SearchInput, statTone } from "../components/ui";
import { computeOvr } from "../engine/ovr";
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
          <Panel title="Overall rating" className="mt-4">
            <div className="flex items-center justify-center gap-3">
              <OvrBadge ovr={breakA.ovr} size="lg" />
              <span className="tnum text-[13px] text-mist">vs</span>
              <OvrBadge ovr={breakB.ovr} size="lg" />
            </div>
            <div className="mt-3">
              <VersusRow label="Overall rating" a={breakA.ovr} b={breakB.ovr} />
            </div>
          </Panel>
        </>
      )}
      <Panel title="Comparison" className="mt-6">
        <p className="text-[14px] text-mist">Stats land here in Task 2.</p>
      </Panel>
    </div>
  );
}

function VersusRow({ label, a, b, decimals = 0 }: { label: string; a: number; b: number; decimals?: number }) {
  const d = a - b;
  const fmt = (v: number) => v.toFixed(decimals);
  return (
    <div className="flex items-center gap-2 text-[14px]">
      <span className="min-w-0 flex-1 truncate text-mist">{label}</span>
      <span className={cn("tnum w-14 shrink-0 text-right font-semibold", d > 0 && statTone(a))}>
        {fmt(a)}
      </span>
      <span className="tnum w-14 shrink-0 text-center text-[13px] text-mist">
        {d === 0 ? "—" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`}
      </span>
      <span className={cn("tnum w-14 shrink-0 text-right font-semibold", d < 0 && statTone(b))}>
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
