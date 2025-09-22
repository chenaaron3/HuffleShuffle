
export function cardCodeToFilename(code: string): string | null {
    if (!code || code.length < 2) return null;
    // Facedown placeholder
    if (code === "FD") return "/cards/facedown-of-blue.svg";
    const rank = code[0]?.toUpperCase();
    const suit = code[1]?.toLowerCase();
    const rankMap: Record<string, string> = {
        A: "ace",
        K: "king",
        Q: "queen",
        J: "jack",
        T: "ten",
        "9": "nine",
        "8": "eight",
        "7": "seven",
        "6": "six",
        "5": "five",
        "4": "four",
        "3": "three",
        "2": "two",
    };
    const suitMap: Record<string, string> = {
        s: "spades",
        h: "hearts",
        d: "diamonds",
        c: "clubs",
    };
    const r = rankMap[rank ?? ""];
    const s = suitMap[suit ?? ""];
    if (!r || !s) return null;
    return `/cards/${r}-of-${s}.svg`;
}

export function CardImage({
    code,
    size = 28,
    className,
    highlighted = false,
}: {
    code: string;
    size?: number;
    className?: string;
    highlighted?: boolean;
}) {
    const src = cardCodeToFilename(code);
    if (!src) return null;

    const baseClasses = "select-none rounded-sm shadow [image-rendering:auto]";
    const highlightedClasses = highlighted
        ? "ring-2 ring-yellow-400 ring-opacity-75 shadow-lg shadow-yellow-400/50"
        : "";

    return (
        <div className="relative">
            {highlighted && (
                <div className="absolute inset-0 rounded-sm bg-gradient-to-r from-yellow-400/10 to-yellow-500/15 blur-sm scale-110 animate-pulse" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={code}
                width={size}
                height={Math.round(size * 1.4)}
                className={`${baseClasses} ${highlightedClasses} ${className ?? ''}`}
                draggable={false}
            />
        </div>
    );
}


