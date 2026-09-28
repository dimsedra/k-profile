import { useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { OvrBadge, Panel, PhotoCard, Portrait, StatBar } from "../components/ui";
import { CATEGORIES, ovrOf } from "../engine/ovr";

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] placeholder:text-mist/60 focus:border-ink/40";
const labelCls = "mb-1.5 block text-[13px] font-semibold";

export function GroupDetail({ id }: { id: number }) {
  const {
    groups, groupStats, groupMemberIds, idols, config,
    ready, isAdmin, updateGroup,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [debutYear, setDebutYear] = useState("");
  const [agency, setAgency] = useState("");
  const [fandomName, setFandomName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const group = groups.find((g) => g.id === id);
  const memberIds = useMemo(() => new Set(groupMemberIds(id)), [groupMemberIds, id]);
  const members = useMemo(
    () => idols.filter((i) => memberIds.has(i.id)),
    [idols, memberIds]
  );
  const stats = group ? groupStats(id) : null;
  const portraitShim = useMemo(
    () => ({
      stageName: group?.name ?? "",
      photo: photoFile ? URL.createObjectURL(photoFile) : group?.photo,
    }),
    [photoFile, group]
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="py-20 text-center font-display font-semibold">Loading group…</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">This group doesn't exist</p>
        <p className="mt-2 text-[14px] text-mist">
          The group may have been removed from the database.
        </p>
        <a href="#/binder" className="mt-4 inline-block font-semibold text-punch">
          Back to the binder
        </a>
      </div>
    );
  }

  const startEdit = () => {
    setBio(group.bio);
    setDebutYear(group.debutYear ? String(group.debutYear) : "");
    setAgency(group.agency);
    setFandomName(group.fandomName);
    setPhotoFile(null);
    setRemovePhoto(false);
    setError("");
    setEditing(true);
  };

  const pickFile = (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("That file isn't a photo or video.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That file is over the 15 MB bucket cap. Compress it first.");
      return;
    }
    setPhotoFile(file);
    setRemovePhoto(false);
    setError("");
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const msg = await updateGroup(
      group.id,
      {
        bio,
        debutYear: debutYear ? Number(debutYear) : undefined,
        agency,
        fandomName,
      },
      { photoFile, removePhoto }
    );
    setBusy(false);
    if (msg) return setError(msg);
    setEditing(false);
  };

  const facts: [string, string][] = [
    ["Debut year", group.debutYear ? String(group.debutYear) : ""],
    ["Agency", group.agency],
    ["Fandom", group.fandomName],
    ["Members", String(members.length)],
  ].filter(([, v]) => v !== "") as [string, string][];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="h-28 w-[75px] shrink-0 overflow-hidden rounded-xl">
          <Portrait idol={portraitShim} className="h-full w-full" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-[14px] text-mist">
            {facts.map(([, v]) => v).join(" · ") || "No profile yet."}
          </p>
        </div>
        <div className="ml-auto">
          {stats ? <OvrBadge ovr={stats.ovr} size="lg" /> : <span className="text-mist">—</span>}
        </div>
      </div>

      {isAdmin && !editing && (
        <button
          onClick={startEdit}
          className="mt-4 rounded-lg bg-ink px-3 py-2 text-[14px] font-semibold text-white hover:bg-ink/90"
        >
          Edit group
        </button>
      )}

      {editing && (
        <Panel className="mt-4" title="Edit group profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="g-debut">Debut year</label>
              <input
                id="g-debut" className={inputCls} type="number" value={debutYear}
                onChange={(e) => setDebutYear(e.target.value)} placeholder="2018"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-agency">Agency</label>
              <input
                id="g-agency" className={inputCls} value={agency}
                onChange={(e) => setAgency(e.target.value)} placeholder="Starship"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-fandom">Fandom name</label>
              <input
                id="g-fandom" className={inputCls} value={fandomName}
                onChange={(e) => setFandomName(e.target.value)} placeholder="DIVE"
              />
            </div>
            <div>
              <span className={labelCls}>Photo</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink"
                >
                  {photoFile ? photoFile.name : group.photo || group.photoPath ? "Replace photo" : "Upload photo"}
                </button>
                {(group.photo || photoFile) && (
                  <button
                    onClick={() => {
                      setPhotoFile(null);
                      setRemovePhoto(true);
                    }}
                    className="text-[12px] font-medium text-mist hover:text-punch"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="g-bio">Bio</label>
              <textarea
                id="g-bio" rows={3} className={inputCls} value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What defines this group?"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white hover:bg-punch/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save group"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-medium text-mist hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {group.bio && (
        <Panel className="mt-4" title="Biography">
          <p className="text-[14px] leading-relaxed text-mist">{group.bio}</p>
        </Panel>
      )}

      {stats ? (
        <Panel className="mt-4" title="Combined stats (popularity-weighted)">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <StatBar key={c.key} label={c.label} value={stats.cats[c.key]} strong />
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-mist">
            Each member pulls the group average with {""}
            {stats.contributions
              .map((ct) => {
                const m = members.find((x) => x.id === ct.memberId);
                return `${m?.stageName ?? "?"} ${ct.weightPct}%`;
              })
              .join(" · ")}
            .
          </p>
        </Panel>
      ) : (
        <Panel className="mt-4" title="No members yet">
          <p className="text-[14px] text-mist">
            Add the first member to compute combined stats.
          </p>
          <a
            href="#/add"
            className="mt-3 inline-block rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white"
          >
            + Add Idol
          </a>
        </Panel>
      )}

      {members.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-[16px] font-semibold">Members</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((m) => (
              <PhotoCard key={m.id} idol={m} ovr={ovrOf(m, config)} href={`#/idol/${m.id}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
