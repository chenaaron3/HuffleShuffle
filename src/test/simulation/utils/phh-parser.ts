/**
 * Parser for Poker Hand History (.phh) files
 * PHH format uses Python-like syntax for poker hands
 */

export interface PHHData {
  variant: string;
  ante_trimming_status: boolean;
  antes: number[];
  blinds_or_straddles?: number[]; // Optional - can be derived from actions for Texas Hold'em
  min_bet?: number; // Optional
  starting_stacks: number[];
  actions: string[];
  author?: string;
  event?: string;
  city?: string;
  region?: string;
  country?: string;
  day?: number;
  month?: number;
  year?: number;
  hand?: number;
  players?: string[];
  finishing_stacks: number[];
}

/**
 * Parse a .phh file content into structured data
 */
export function parsePHH(content: string): PHHData {
  const lines = content
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"));

  const data: Partial<PHHData> = {};

  for (const line of lines) {
    const match = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!match) continue;

    const key = match[1];
    const valueStr = match[2];
    if (!key || !valueStr) continue;

    const value = parseValue(valueStr.trim());

    (data as any)[key] = value;
  }

  // Validate required fields
  // Note: blinds_or_straddles is optional for Texas Hold'em (can be derived from actions)
  const required: (keyof PHHData)[] = [
    "variant",
    "ante_trimming_status",
    "antes",
    "starting_stacks",
    "actions",
    "finishing_stacks",
  ];

  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return data as PHHData;
}

/**
 * Parse a Python value string into a JavaScript value
 */
function parseValue(str: string): any {
  // Boolean
  if (str === "True" || str === "true") return true;
  if (str === "False" || str === "false") return false;

  // String (single or double quotes)
  if (
    (str.startsWith("'") && str.endsWith("'")) ||
    (str.startsWith('"') && str.endsWith('"'))
  ) {
    return str.slice(1, -1);
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return Number(str);
  }

  // Array
  if (str.startsWith("[") && str.endsWith("]")) {
    const content = str.slice(1, -1).trim();
    if (!content) return [];

    // Split by comma, handling quoted strings
    const items: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < content.length; i++) {
      const char = content[i]!;

      if ((char === "'" || char === '"') && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
        current += char;
      } else if (char === "," && !inQuotes) {
        items.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      items.push(current.trim());
    }

    return items.map((item) => parseValue(item));
  }

  // Return as-is if we can't parse
  return str;
}

/**
 * Parse a card string (e.g., "As", "7h", "Td") into rank and suit
 */
export function parseCard(card: string): { rank: string; suit: string } {
  if (card.length !== 2) {
    throw new Error(`Invalid card format: ${card}`);
  }

  const rank = card[0]!.toUpperCase();
  const suit = card[1]!.toLowerCase();

  // Validate rank
  const validRanks = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "T",
    "J",
    "Q",
    "K",
    "A",
  ];
  if (!validRanks.includes(rank)) {
    throw new Error(`Invalid rank: ${rank}`);
  }

  // Validate suit
  const validSuits = ["c", "d", "h", "s"];
  if (!validSuits.includes(suit)) {
    throw new Error(`Invalid suit: ${suit}`);
  }

  return { rank, suit };
}

/**
 * Parse a PHH action string
 */
export interface PHHAction {
  type:
    | "deal_hole"
    | "deal_board"
    | "fold"
    | "check"
    | "call"
    | "bet"
    | "raise"
    | "showdown";
  player?: number; // 1-indexed player number
  amount?: number;
  cards?: string[];
}

export function parseAction(action: string): PHHAction {
  const parts = action.trim().split(/\s+/);

  // Deal hole cards: "d dh p1 7s4s"
  if (parts[0] === "d" && parts[1] === "dh") {
    const playerMatch = parts[2]?.match(/^p(\d+)$/);
    if (!playerMatch) throw new Error(`Invalid deal hole action: ${action}`);

    const cards = parts[3]?.match(/.{2}/g) || [];
    return {
      type: "deal_hole",
      player: parseInt(playerMatch[1]!),
      cards,
    };
  }

  // Deal board cards: "d db JcTs2d"
  if (parts[0] === "d" && parts[1] === "db") {
    const cards = parts[2]?.match(/.{2}/g) || [];
    return {
      type: "deal_board",
      cards,
    };
  }

  // Player actions: "p3 f", "p2 cc", "p4 cbr 170000"
  const playerMatch = parts[0]?.match(/^p(\d+)$/);
  if (playerMatch) {
    const player = parseInt(playerMatch[1]!);
    const actionType = parts[1];

    switch (actionType) {
      case "f":
        return { type: "fold", player };

      case "cc":
        return { type: "check", player }; // cc = call/check

      case "cbr": {
        const amount = parseInt(parts[2] || "0");
        return { type: "raise", player, amount };
      }

      case "sm": {
        // Showdown/show-muck - for now we'll handle this as showdown trigger
        const cards = parts[2]?.match(/.{2}/g) || [];
        return { type: "showdown", player, cards };
      }

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  throw new Error(`Failed to parse action: ${action}`);
}
