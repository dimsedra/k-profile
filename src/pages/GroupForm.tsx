import { useRef, useState } from "react";
import { useStore, isExternalPhoto } from "../store";
import { Panel } from "../components/ui";
import { SuggestInput } from "../components/SuggestInput";
import { navigate } from "../router";

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] placeholder:text-mist/60 focus:border-ink/40";
const labelCls = "mb-1.5 block text-[13px] font-semibold";

export function GroupForm() {
  const { ready, isAdmin, agencies, addGroup } = useStore();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [debutYear, setDebutYear] = useState("");
  const [agency, setAgency] = useState("");
  const [fandomName, setFandomName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLink, setPhotoLink] = useState("");
  const [error, setError] = useState("");
  const [dupId, setDupId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Admins only</p>
        <p className="mt-2 text-[14px] text-mist">
          The catalog is public, but adding groups needs an admin account.
        </p>
        <a
          href="#/login"
          className="mt-5 inline-block rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white"
        >
          Sign in as admin
        </a>
      </div>
    );
  }

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
    setPhotoLink("");
    setError("");
  };

  const useLink = () => {
    const link = photoLink.trim();
    if (!isExternalPhoto(link)) {
      setError("That link isn't a valid http(s) image URL.");
      return;
    }
    setPhotoFile(null);
    setError("");
  };

  const save = async () => {
    if (!name.trim()) return setError("Group name is required.");
    if (!photoFile && photoLink.trim() && !isExternalPhoto(photoLink.trim()))
      return setError("That link isn't a valid http(s) image URL — fix or clear it.");
    setError("");
    setDupId(null);
    setBusy(true);
    const res = await addGroup(
      {
        name: name.trim(),
        bio,
        debutYear: debutYear ? Number(debutYear) : undefined,
        agency,
        fandomName,
        photoUrl: photoFile ? undefined : photoLink.trim() || undefined,
      },
      photoFile
    );
    setBusy(false);
    if (res.error) {
      setError(res.error);
      if (res.id !== undefined) setDupId(res.id);
      return;
    }
    if (res.id !== undefined) navigate(`/group/${res.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">New group</h1>
      <p className="mt-1 text-[13px] text-mist">
        Names match case-insensitively — “ive” will point at existing “IVE”.
      </p>

      <Panel className="mt-6" title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="g-name">Group name</label>
            <input
              id="g-name" className={inputCls} value={name}
              onChange={(e) => setName(e.target.value)} placeholder="IVE"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="g-debut">Debut year</label>
            <input
              id="g-debut" className={inputCls} type="number" value={debutYear}
              onChange={(e) => setDebutYear(e.target.value)} placeholder="2021"
            />
          </div>
          <div>
            <SuggestInput
              id="g-agency"
              label="Agency"
              value={agency}
              options={agencies}
              onChange={setAgency}
              placeholder="Starship Entertainment"
              matchedText={(name) => <>Matched canonical spelling: <strong>{name}</strong></>}
              newText={(v) => <>New agency — “{v}” will be added automatically on save.</>}
              emptyText="Start typing to match an existing agency. Leave blank for none."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="g-fandom">Fandom name</label>
            <input
              id="g-fandom" className={inputCls} value={fandomName}
              onChange={(e) => setFandomName(e.target.value)} placeholder="DIVE"
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
          <div className="sm:col-span-2">
            <span className={labelCls}>Photo (optional)</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink"
              >
                {photoFile ? photoFile.name : "Choose file"}
              </button>
              {photoFile && (
                <button
                  onClick={() => setPhotoFile(null)}
                  className="text-[12px] font-medium text-mist hover:text-punch"
                >
                  Remove
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
            <div className="mt-3 border-t border-line pt-3">
              <label className={labelCls} htmlFor="g-photolink">Or paste an image link</label>
              <div className="flex gap-2">
                <input
                  id="g-photolink" className={inputCls} value={photoLink}
                  onChange={(e) => setPhotoLink(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
                <button
                  onClick={useLink}
                  className="shrink-0 rounded-lg bg-punch/10 px-3 py-2 text-[13px] font-semibold text-punch hover:bg-punch hover:text-white"
                >
                  Use link
                </button>
              </div>
              {photoLink.trim() && !photoFile && (
                <p className="mt-1 text-[12px] text-mist">
                  Linked image will be used — zero bucket quota.
                </p>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
            {error}{" "}
            {dupId !== null && (
              <a href={`#/group/${dupId}`} className="underline">
                Open the existing group
              </a>
            )}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void save()}
            disabled={busy}
            className="rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white hover:bg-punch/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add group"}
          </button>
          <button
            onClick={() => navigate("/binder")}
            className="rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-medium text-mist hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Panel>
    </div>
  );
}
