import { playerGridColumnCount } from './seat-overlay-logic';

export type HudActionTone =
    | 'none'
    | 'check'
    | 'call'
    | 'raise'
    | 'fold'
    | 'all-in'
    | 'eliminated';

export type HudRole = 'BU' | 'SB' | 'BB' | null;

export interface HudSeatSnapshot {
    id: string;
    seatNumber: number;
    playerId: string | null;
    buyIn: number;
    currentBet: number;
    seatStatus: string;
    lastAction: string | null;
    winAmount?: number | null;
}

export interface HudCell {
    seatNumber: number;
    occupied: boolean;
    stack: number;
    bet: number;
    role: HudRole;
    tone: HudActionTone;
    dimmed: boolean;
    isSelf: boolean;
    isActor: boolean;
    isWinner: boolean;
    label: string;
}

interface HudGridInput {
    seats: readonly HudSeatSnapshot[];
    smallBlindSeatNumber: number;
    bigBlindSeatNumber: number;
    dealerButtonSeatNumber: number;
    highlightedSeatId: string | null;
    myUserId: string | null;
    gameState: string | undefined;
}

function resolveRole(seatNumber: number, input: HudGridInput): HudRole {
    if (seatNumber === input.dealerButtonSeatNumber) return 'BU';
    if (seatNumber === input.smallBlindSeatNumber) return 'SB';
    if (seatNumber === input.bigBlindSeatNumber) return 'BB';
    return null;
}

function resolveTone(seat: HudSeatSnapshot): HudActionTone {
    if (seat.seatStatus === 'eliminated') return 'eliminated';
    if (seat.seatStatus === 'all-in') return 'all-in';
    if (seat.seatStatus === 'folded' || seat.lastAction === 'FOLD') return 'fold';
    if (seat.lastAction === 'RAISE') return 'raise';
    if (seat.lastAction === 'CALL') return 'call';
    if (seat.lastAction === 'CHECK') return 'check';
    return 'none';
}

function roleLabel(role: HudRole): string | null {
    if (role === 'BU') return 'button';
    if (role === 'SB') return 'small blind';
    if (role === 'BB') return 'big blind';
    return null;
}

function cellLabel(cell: Omit<HudCell, 'label'>): string {
    if (!cell.occupied) return `Seat ${cell.seatNumber + 1} empty`;
    const parts = [`Seat ${cell.seatNumber + 1}`];
    const role = roleLabel(cell.role);
    if (role) parts.push(role);
    parts.push(`stack $${cell.stack}`);
    if (cell.bet > 0) parts.push(`bet $${cell.bet}`);
    if (cell.tone !== 'none') parts.push(cell.tone);
    if (cell.isSelf) parts.push('you');
    if (cell.isActor) parts.push('to act');
    if (cell.isWinner) parts.push('winner');
    return parts.join(', ');
}

function resolveHudCell(
    seat: HudSeatSnapshot | undefined,
    seatNumber: number,
    input: HudGridInput,
): HudCell {
    const occupied = !!seat?.playerId;
    const tone = occupied && seat ? resolveTone(seat) : 'none';
    const cell: Omit<HudCell, 'label'> = {
        seatNumber,
        occupied,
        stack: occupied && seat ? seat.buyIn : 0,
        bet: occupied && seat ? seat.currentBet : 0,
        role: occupied ? resolveRole(seatNumber, input) : null,
        tone,
        dimmed: tone === 'fold' || tone === 'eliminated',
        isSelf: occupied && !!input.myUserId && seat?.playerId === input.myUserId,
        isActor: occupied && !!seat && seat.id === input.highlightedSeatId,
        isWinner:
            occupied &&
            input.gameState === 'SHOWDOWN' &&
            (seat?.winAmount ?? 0) > 0,
    };
    return { ...cell, label: cellLabel(cell) };
}

export function buildHudGrid(input: HudGridInput): HudCell[][] {
    const occupied = input.seats
        .filter((seat) => !!seat.playerId)
        .sort((a, b) => a.seatNumber - b.seatNumber);
    const columns = playerGridColumnCount(occupied.length);
    const cells = occupied.map((seat) => resolveHudCell(seat, seat.seatNumber, input));
    const rows: HudCell[][] = [];
    for (let index = 0; index < cells.length; index += columns) {
        rows.push(cells.slice(index, index + columns));
    }
    return rows;
}
