import { useMemo } from "react";
import { useStore } from "../store";
import { ovrOf } from "../engine/ovr";
import { PhotoCard } from "../components/ui";

export function Binder() {
  const { idols, config, ready } = useStore();

  const cards = useMemo(
    () =>
      idols
        .map((idol) => ({ idol, ovr: ovrOf(idol, config) }))
        .sort((a, b) => b.ovr - a.ovr),
    [idols, config]
  );

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

      {cards.length === 0 ? (
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
