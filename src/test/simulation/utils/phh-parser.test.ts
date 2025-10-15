/**
 * Unit tests for PHH parser and dealer button logic
 */

import { describe, expect, it } from 'vitest';

import { parseAction, parseCard, parsePHH } from './phh-parser';
import { getDealerButtonPlayer } from './phh-to-scenario';

describe("PHH Parser", () => {
  describe("parseCard", () => {
    it("should parse valid cards", () => {
      expect(parseCard("As")).toEqual({ rank: "A", suit: "s" });
      expect(parseCard("7h")).toEqual({ rank: "7", suit: "h" });
      expect(parseCard("Td")).toEqual({ rank: "T", suit: "d" });
      expect(parseCard("Kc")).toEqual({ rank: "K", suit: "c" });
    });

    it("should throw on invalid cards", () => {
      expect(() => parseCard("1s")).toThrow("Invalid rank");
      expect(() => parseCard("Ax")).toThrow("Invalid suit");
      expect(() => parseCard("A")).toThrow("Invalid card format");
    });
  });

  describe("parseAction", () => {
    it("should parse deal hole cards", () => {
      const action = parseAction("d dh p1 7s4s");
      expect(action).toEqual({
        type: "deal_hole",
        player: 1,
        cards: ["7s", "4s"],
      });
    });

    it("should parse deal board cards", () => {
      const action = parseAction("d db JcTs2d");
      expect(action).toEqual({
        type: "deal_board",
        cards: ["Jc", "Ts", "2d"],
      });
    });

    it("should parse player actions", () => {
      expect(parseAction("p3 f")).toEqual({
        type: "fold",
        player: 3,
      });

      expect(parseAction("p2 cc")).toEqual({
        type: "check",
        player: 2,
      });

      expect(parseAction("p4 cbr 170000")).toEqual({
        type: "raise",
        player: 4,
        amount: 170000,
      });
    });
  });

  describe("parsePHH", () => {
    it("should parse a complete PHH file", () => {
      const content = `
variant = 'NT'
ante_trimming_status = false
antes = [0, 120000, 0, 0, 0]
blinds_or_straddles = [40000, 80000, 0, 0, 0]
min_bet = 80000
starting_stacks = [7380000, 2500000, 5110000, 10170000, 4545000]
actions = ['d dh p1 7s4s', 'd dh p2 Js8h']
finishing_stacks = [7340000, 3775000, 5110000, 8935000, 4545000]
      `.trim();

      const phh = parsePHH(content);
      expect(phh.variant).toBe("NT");
      expect(phh.ante_trimming_status).toBe(false);
      expect(phh.antes).toEqual([0, 120000, 0, 0, 0]);
      expect(phh.starting_stacks.length).toBe(5);
      expect(phh.actions.length).toBe(2);
    });
  });
});

describe("Dealer Button Logic", () => {
  it("should correctly determine dealer button from blinds", () => {
    // Standard 5-player: SB at p1, BB at p2 → Button at p5
    expect(getDealerButtonPlayer([40000, 80000, 0, 0, 0])).toBe(5);

    // Standard 9-player: SB at p1, BB at p2 → Button at p9
    expect(getDealerButtonPlayer([5, 10, 0, 0, 0, 0, 0, 0, 0])).toBe(9);

    // Button at p2: SB at p3, BB at p4
    expect(getDealerButtonPlayer([0, 0, 5, 10, 0, 0])).toBe(2);

    // Heads-up: SB at p1, BB at p2 → Button at p2 (wraps around)
    expect(getDealerButtonPlayer([5, 10])).toBe(2);
  });

  it("should handle no blinds by defaulting to last player", () => {
    expect(getDealerButtonPlayer([0, 0, 0, 0, 0])).toBe(5);
  });

  it("should handle wraparound correctly", () => {
    // SB at p1 (index 0) → Button should wrap to last player
    expect(getDealerButtonPlayer([10, 20, 0, 0, 0, 0])).toBe(6);
  });

  it("should work with different blind structures", () => {
    // Ante game: all players post antes, SB at p1
    expect(getDealerButtonPlayer([10, 20, 5, 5, 5])).toBe(5);

    // Straddle: SB, BB, Straddle
    expect(getDealerButtonPlayer([10, 20, 40, 0, 0])).toBe(5);
  });
});
