export type SizeEntry = {
  label: string;
  length: number; // longer dimension in metres
  width: number;  // shorter dimension in metres
};

export type RiboliFormat = {
  format: string;
  players: number;
  totalPlayers: number;
  sizes: [SizeEntry, SizeEntry, SizeEntry]; // [SSG, MSG, LSG]
};

export type CoachingFormat = {
  format: string;
  players: number;
  totalPlayers: number;
  wr: string;
  sizes: [SizeEntry, SizeEntry, SizeEntry]; // [Small, Med, Large]
};

// Riboli et al. — normalised to length (longer) × width (shorter)
export const riboliData: RiboliFormat[] = [
  { format: "1v1", players: 1, totalPlayers: 2, sizes: [{ label: "SSG", length: 8, width: 5 }, { label: "MSG", length: 12, width: 8 }, { label: "LSG", length: 17, width: 11 }] },
  { format: "2v2", players: 2, totalPlayers: 4, sizes: [{ label: "SSG", length: 12, width: 7 }, { label: "MSG", length: 15, width: 10 }, { label: "LSG", length: 25, width: 15 }] },
  { format: "3v3", players: 3, totalPlayers: 6, sizes: [{ label: "SSG", length: 15, width: 10 }, { label: "MSG", length: 20, width: 12 }, { label: "LSG", length: 30, width: 20 }] },
  { format: "4v4", players: 4, totalPlayers: 8, sizes: [{ label: "SSG", length: 30, width: 20 }, { label: "MSG", length: 37, width: 23 }, { label: "LSG", length: 37, width: 27 }] },
  { format: "5v5", players: 5, totalPlayers: 10, sizes: [{ label: "SSG", length: 35, width: 22 }, { label: "MSG", length: 40, width: 25 }, { label: "LSG", length: 45, width: 30 }] },
  { format: "6v6", players: 6, totalPlayers: 12, sizes: [{ label: "SSG", length: 40, width: 27 }, { label: "MSG", length: 50, width: 30 }, { label: "LSG", length: 55, width: 35 }] },
  { format: "7v7", players: 7, totalPlayers: 14, sizes: [{ label: "SSG", length: 45, width: 30 }, { label: "MSG", length: 55, width: 35 }, { label: "LSG", length: 60, width: 36 }] },
  { format: "8v8", players: 8, totalPlayers: 16, sizes: [{ label: "SSG", length: 50, width: 33 }, { label: "MSG", length: 60, width: 40 }, { label: "LSG", length: 71, width: 42 }] },
  { format: "9v9", players: 9, totalPlayers: 18, sizes: [{ label: "SSG", length: 60, width: 40 }, { label: "MSG", length: 70, width: 45 }, { label: "LSG", length: 80, width: 48 }] },
  { format: "10v10", players: 10, totalPlayers: 20, sizes: [{ label: "SSG", length: 70, width: 45 }, { label: "MSG", length: 80, width: 50 }, { label: "LSG", length: 90, width: 54 }] },
  { format: "11v11", players: 11, totalPlayers: 22, sizes: [{ label: "SSG", length: 80, width: 48 }, { label: "MSG", length: 90, width: 52 }, { label: "LSG", length: 100, width: 60 }] },
];

export const coachingData: CoachingFormat[] = [
  { format: "1v1", players: 1, totalPlayers: 2, wr: "1:1–1:2", sizes: [{ label: "Small", length: 10, width: 5 }, { label: "Med", length: 15, width: 10 }, { label: "Large", length: 20, width: 15 }] },
  { format: "2v2", players: 2, totalPlayers: 4, wr: "1:1–2:1", sizes: [{ label: "Small", length: 15, width: 10 }, { label: "Med", length: 20, width: 15 }, { label: "Large", length: 25, width: 20 }] },
  { format: "3v3", players: 3, totalPlayers: 6, wr: "1:1–2:1", sizes: [{ label: "Small", length: 20, width: 12 }, { label: "Med", length: 25, width: 15 }, { label: "Large", length: 30, width: 18 }] },
  { format: "4v4", players: 4, totalPlayers: 8, wr: "2:1–3:1", sizes: [{ label: "Small", length: 24, width: 16 }, { label: "Med", length: 30, width: 20 }, { label: "Large", length: 36, width: 24 }] },
  { format: "5v5", players: 5, totalPlayers: 10, wr: "2:1–3:1", sizes: [{ label: "Small", length: 28, width: 20 }, { label: "Med", length: 35, width: 25 }, { label: "Large", length: 42, width: 30 }] },
  { format: "6v6", players: 6, totalPlayers: 12, wr: "2:1–3:1", sizes: [{ label: "Small", length: 32, width: 24 }, { label: "Med", length: 40, width: 30 }, { label: "Large", length: 48, width: 36 }] },
  { format: "7v7", players: 7, totalPlayers: 14, wr: "2:1–3:1", sizes: [{ label: "Small", length: 50, width: 30 }, { label: "Med", length: 55, width: 36 }, { label: "Large", length: 60, width: 40 }] },
  { format: "8v8", players: 8, totalPlayers: 16, wr: "4:1–6:1", sizes: [{ label: "Small", length: 60, width: 40 }, { label: "Med", length: 70, width: 46 }, { label: "Large", length: 75, width: 50 }] },
  { format: "9v9", players: 9, totalPlayers: 18, wr: "4:1–6:1", sizes: [{ label: "Small", length: 75, width: 50 }, { label: "Med", length: 85, width: 60 }, { label: "Large", length: 95, width: 60 }] },
  { format: "10v10", players: 10, totalPlayers: 20, wr: "4:1–6:1", sizes: [{ label: "Small", length: 80, width: 50 }, { label: "Med", length: 95, width: 58 }, { label: "Large", length: 105, width: 68 }] },
];
