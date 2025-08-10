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
}: {
    code: string;
    size?: number;
    className?: string;
}) {
    const src = cardCodeToFilename(code);
    if (!src) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={code}
            width={size}
            height={Math.round(size * 1.4)}
            className={
                className ??
                "h-7 w-5 select-none rounded-sm shadow [image-rendering:auto]"
            }
            draggable={false}
        />
    );
}


