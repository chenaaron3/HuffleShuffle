declare module "pokersolver" {
  export interface Hand {
    name: string;
    descr: string;
    cards: string[];
    score: number;
    rank: number;
  }

  export class Hand {
    static solve(cards: string[]): Hand;
    static winners(hands: Hand[]): Hand[];
  }
}
