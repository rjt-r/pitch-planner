import { riboliData, coachingData } from "@/lib/pitch-sizes";

export type SeedConfig = {
  totalPlayers: number;
  refRpa: number;
  refLabel: string;
  length: number;
  width: number;
};

function rpa(length: number, width: number, totalPlayers: number) {
  return (length * width) / totalPlayers;
}

function RefCard({
  label,
  length,
  width,
  totalPlayers,
  badge,
  isSelected,
  onClick,
}: {
  label: string;
  length: number;
  width: number;
  totalPlayers: number;
  badge?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const area = length * width;
  const rpaVal = rpa(length, width, totalPlayers);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? "border-green-500 bg-zinc-900"
          : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-mono tracking-widest uppercase ${isSelected ? "text-green-400" : "text-zinc-500"}`}>
          {label}
        </span>
        {badge && (
          <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{badge}</span>
        )}
      </div>
      <p className="text-base font-semibold text-white">
        {length} × {width} <span className="text-xs font-normal text-zinc-500">m</span>
      </p>
      <p className="text-xs text-zinc-600 mt-0.5">
        {area} m² · {rpaVal.toFixed(1)} m²/pl
      </p>
    </button>
  );
}

export default function ReferencePanel({
  format,
  selectedKey,
  onSelect,
}: {
  format: string;
  selectedKey: string | null;
  onSelect: (cfg: SeedConfig, key: string) => void;
}) {
  const riboli = riboliData.find((d) => d.format === format);
  const coaching = coachingData.find((d) => d.format === format);

  if (!riboli) return null;

  return (
    <div>
      <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
        Step 2 — Pick a reference size to seed the canvas
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Riboli panel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-200">Riboli et al.</p>
            <span className="text-xs text-zinc-600">Match-demand benchmarks</span>
          </div>
          <div className="space-y-2">
            {riboli.sizes.map((s) => {
              const key = `riboli-${s.label}`;
              return (
                <RefCard
                  key={key}
                  label={s.label}
                  length={s.length}
                  width={s.width}
                  totalPlayers={riboli.totalPlayers}
                  isSelected={selectedKey === key}
                  onClick={() =>
                    onSelect(
                      {
                        totalPlayers: riboli.totalPlayers,
                        refRpa: rpa(s.length, s.width, riboli.totalPlayers),
                        refLabel: `Riboli ${s.label}`,
                        length: s.length,
                        width: s.width,
                      },
                      key
                    )
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Coaching panel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-200">Coaching guide</p>
            <span className="text-xs text-zinc-600">Practical sizes</span>
          </div>
          {coaching ? (
            <div className="space-y-2">
              {coaching.sizes.map((s) => {
                const key = `coaching-${s.label}`;
                return (
                  <RefCard
                    key={key}
                    label={s.label}
                    length={s.length}
                    width={s.width}
                    totalPlayers={coaching.totalPlayers}
                    badge={coaching.wr}
                    isSelected={selectedKey === key}
                    onClick={() =>
                      onSelect(
                        {
                          totalPlayers: coaching.totalPlayers,
                          refRpa: rpa(s.length, s.width, coaching.totalPlayers),
                          refLabel: `Coaching ${s.label}`,
                          length: s.length,
                          width: s.width,
                        },
                        key
                      )
                    }
                  />
                );
              })}
              <p className="text-xs text-zinc-700">W/R = recommended width:length ratio range</p>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-lg p-4 text-zinc-600 text-sm">
              No coaching data for {format}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
