const FORMATS = ["1v1","2v2","3v3","4v4","5v5","6v6","7v7","8v8","9v9","10v10","11v11"];

export default function FormatSelector({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (f: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
        Step 1 — Game format
      </p>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((f) => (
          <button
            key={f}
            onClick={() => onSelect(f)}
            className={`px-3 py-2 rounded text-sm border transition-colors ${
              selected === f
                ? "bg-green-500 text-black border-green-500 font-semibold"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
