"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLibrary,
  removeFromLibrary,
  renameInLibrary,
  relativeTime,
  type LibraryDrill,
} from "@/lib/drill-library";

interface DrillLibraryProps {
  /** Called when the coach clicks "Use in session →" on a card. */
  onLoadDrill: (drill: LibraryDrill) => void;
}

export default function DrillLibrary({ onLoadDrill }: DrillLibraryProps) {
  const [library, setLibrary] = useState<LibraryDrill[]>([]);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = useCallback(() => setLibrary(getLibrary()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleDelete(id: string) {
    removeFromLibrary(id);
    setConfirmDeleteId(null);
    refresh();
  }

  function startRename(drill: LibraryDrill) {
    setRenamingId(drill.id);
    setRenameValue(drill.name);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) renameInLibrary(id, trimmed);
    setRenamingId(null);
    refresh();
  }

  const filtered = library.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search drills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-green-700"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>
        <span className="text-xs text-zinc-600 shrink-0">
          {library.length} saved
        </span>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-zinc-600 text-sm">
          {library.length === 0 ? (
            <>
              <p className="mb-1 font-medium text-zinc-500">No saved drills yet</p>
              <p className="text-xs">
                Click &ldquo;Save to library&rdquo; on any drill in your session to start building your coaching library.
              </p>
            </>
          ) : (
            <p>No drills match &ldquo;{search}&rdquo;</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((drill) => {
            const isConfirmingDelete = confirmDeleteId === drill.id;
            const isRenaming = renamingId === drill.id;

            return (
              <div
                key={drill.id}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 space-y-2"
              >
                {/* Name row */}
                <div className="flex items-start justify-between gap-2">
                  {isRenaming ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(drill.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-0 bg-zinc-900 border border-green-700 rounded px-2 py-1 text-sm text-white focus:outline-none"
                      />
                      <button
                        onClick={() => commitRename(drill.id)}
                        className="text-xs text-green-400 hover:text-green-300 shrink-0"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="text-xs text-zinc-600 hover:text-zinc-300 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-white truncate flex-1 min-w-0">
                      {drill.name}
                    </p>
                  )}
                  <span className="text-xs text-zinc-700 shrink-0 pt-0.5">
                    {relativeTime(drill.savedAt)}
                  </span>
                </div>

                {/* Meta row */}
                <p className="text-xs text-zinc-500">
                  {drill.format} · RPA {drill.rpa.toFixed(1)} m²/pl · {drill.durationMins} min · RPE {drill.rpe}
                </p>

                {/* GPS summary */}
                <p className="text-xs font-mono text-zinc-600">
                  ~{drill.gps.distance.toLocaleString()}m dist
                  {drill.gps.hsr > 0 && ` · ~${drill.gps.hsr}m HSR`}
                  {drill.gps.sprint > 0 && ` · ~${drill.gps.sprint}m sprint`}
                  {` · ~${drill.gps.accels} acc · ~${drill.gps.decels} dec`}
                </p>

                {/* Action row */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onLoadDrill(drill)}
                    className="text-xs bg-green-700/20 border border-green-700/40 text-green-400 hover:bg-green-700/30 hover:text-green-300 px-3 py-1.5 rounded transition-colors"
                  >
                    Use in session →
                  </button>

                  {!isRenaming && (
                    <button
                      onClick={() => startRename(drill)}
                      className="text-xs border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 px-2.5 py-1.5 rounded transition-colors"
                    >
                      Rename
                    </button>
                  )}

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs text-zinc-500">Remove?</span>
                      <button
                        onClick={() => handleDelete(drill.id)}
                        className="text-xs border border-red-900 text-red-400 hover:bg-red-950 px-2 py-1 rounded transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs border border-zinc-800 text-zinc-500 hover:text-white px-2 py-1 rounded transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(drill.id)}
                      className="text-xs border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-900 px-2.5 py-1.5 rounded transition-colors ml-auto"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
