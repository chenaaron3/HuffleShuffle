export function parseBarcodeToRankSuit(barcode: string): {
  rank: string;
  suit: string;
} {
  const suitCode = barcode.slice(0, 1);
  const rankCode = barcode.slice(1);
  const suitMap: Record<string, string> = {
    "1": "s",
    "2": "h",
    "3": "c",
    "4": "d",
  };
  const rankMap: Record<string, string> = {
    "010": "A",
    "020": "2",
    "030": "3",
    "040": "4",
    "050": "5",
    "060": "6",
    "070": "7",
    "080": "8",
    "090": "9",
    "100": "T",
    "110": "J",
    "120": "Q",
    "130": "K",
  };
  const suit = suitMap[suitCode];
  const rank = rankMap[rankCode];
  if (!suit || !rank) throw new Error("Invalid barcode");
  return { rank, suit };
}

export function parseRankSuitToBarcode(rank: string, suit: string): string {
  const suitMap: Record<string, string> = {
    s: "1",
    h: "2",
    c: "3",
    d: "4",
  };
  const rankMap: Record<string, string> = {
    A: "010",
    "2": "020",
    "3": "030",
    "4": "040",
    "5": "050",
    "6": "060",
    "7": "070",
    "8": "080",
    "9": "090",
    T: "100",
    J: "110",
    Q: "120",
    K: "130",
  };
  const suitCode = suitMap[suit];
  const rankCode = rankMap[rank];
  if (!suitCode || !rankCode) throw new Error("Invalid rank or suit");
  return `${suitCode}${rankCode}`;
}
