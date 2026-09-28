import { useState } from "react";

const labelCls = "mb-1.5 block text-[13px] font-semibold";
const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] placeholder:text-mist/60 focus:border-ink/40";

/**
 * Suggest-on-type field with closest-match suggestions. Matching is
 * case-insensitive, so typing "ive" surfaces canonical "IVE". Picking a
 * suggestion (or typing an exact match) stores the canonical spelling;
 * a brand-new name is auto-added as an entry on save.
 */
export function SuggestInput({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  matchedText,
  newText,
  emptyText,
}: {
  id: string;
  label: string;
  value: string;
  options: { id: number; name: string }[];
  onChange: (v: string) => void;
  placeholder: string;
  matchedText: (name: string) => React.ReactNode;
  newText: (v: string) => React.ReactNode;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const q = value.trim().toLowerCase();
  const exact = q ? options.find((o) => o.name.toLowerCase() === q) : undefined;
  const suggestions = (q
    ? options.filter((o) => o.name.toLowerCase().includes(q) && o.name.toLowerCase() !== q)
    : options
  ).slice(0, 8);
  const hi = suggestions.length > 0 ? highlight % suggestions.length : 0;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className={labelCls} htmlFor={id}>{label}</label>
      <input
        id={id}
        className={inputCls}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp" && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" && open && suggestions.length > 0) {
            e.preventDefault();
            pick(suggestions[hi].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-suggest`}
        aria-autocomplete="list"
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={`${id}-suggest`}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-paper py-1 shadow-lg"
        >
          {suggestions.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o.name);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={
                i === hi
                  ? "cursor-pointer bg-sleeve px-3 py-1.5 text-[14px] font-medium"
                  : "cursor-pointer px-3 py-1.5 text-[14px] text-mist"
              }
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[12px] text-mist">
        {exact ? matchedText(exact.name) : q ? newText(value.trim()) : emptyText}
      </p>
    </div>
  );
}
