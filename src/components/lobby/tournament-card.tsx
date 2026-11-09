import { Check, Eye } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { formatTournamentTime } from "~/lib/tournament-schedule";
import { MAX_SEATS_PER_TABLE } from "~/server/db/schema";
import type { RouterOutputs } from "~/utils/api";

export type LobbyTournament = RouterOutputs["tournament"]["list"][number];

const primaryBtn =
  "h-8 rounded-lg bg-landing-gold px-3.5 text-sm font-semibold text-landing-ink transition-colors hover:bg-landing-gold-bright disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

interface TournamentCardProps {
  tournament: LobbyTournament;
  userId: string;
  isDealer: boolean;
  busy: boolean;
  onRegister: () => void;
  onUnregister: () => void;
  onJoinTable: () => void;
  onGoToTable: () => void;
  onCancel: () => void;
}

export function TournamentCard({
  tournament: t,
  userId,
  isDealer,
  busy,
  onRegister,
  onUnregister,
  onJoinTable,
  onGoToTable,
  onCancel,
}: TournamentCardProps) {
  const seated = t.registrations.filter((r) => r.isSeated);
  const waitlist = t.registrations.filter((r) => !r.isSeated);
  const mine = t.registrations.find((r) => r.userId === userId);
  const isFull = seated.length >= MAX_SEATS_PER_TABLE;

  /** For screen readers; the avatar slots show this visually. */
  const capacityLabel = `${seated.length} of ${MAX_SEATS_PER_TABLE} seats taken`;

  // Footer: what's my status, and what's the one thing I can do next?
  let status: ReactNode = null;
  let primary: ReactNode = null;
  let secondary: ReactNode = null;

  if (isDealer) {
    if (t.status !== "in_progress") {
      secondary = (
        <button className={ghostBtn} disabled={busy} onClick={onCancel}>
          Cancel game
        </button>
      );
    }
  } else if (mine?.isAtTable) {
    status = <StatusText tone="gold">You&apos;re at the table</StatusText>;
    primary = (
      <button className={primaryBtn} onClick={onGoToTable}>
        Go to table
      </button>
    );
  } else if (t.status === "in_progress") {
    status = <StatusText>Game in progress</StatusText>;
  } else if (mine?.isSeated) {
    status = (
      <StatusText tone="gold">
        <Check className="size-4" /> Seat reserved
      </StatusText>
    );
    secondary = (
      <button className={ghostBtn} disabled={busy} onClick={onUnregister}>
        Cancel
      </button>
    );
    if (t.status === "open") {
      primary = (
        <button className={primaryBtn} disabled={busy} onClick={onJoinTable}>
          Join table
        </button>
      );
    }
  } else if (mine) {
    status = (
      <StatusText>#{mine.position - MAX_SEATS_PER_TABLE} on standby</StatusText>
    );
    secondary = (
      <button className={ghostBtn} disabled={busy} onClick={onUnregister}>
        Leave standby
      </button>
    );
  } else if (t.status === "open" && !isFull) {
    // After the start time, anyone can walk in while there's room.
    primary = (
      <button className={primaryBtn} disabled={busy} onClick={onJoinTable}>
        Join table
      </button>
    );
  } else {
    primary = (
      <button className={primaryBtn} disabled={busy} onClick={onRegister}>
        {isFull ? "Join standby" : "Reserve seat"}
      </button>
    );
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-zinc-950 p-4 transition-colors hover:border-white/20">
      {/* Header: details on the left, seats on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-landing-gold truncate text-xs font-semibold tracking-wider uppercase">
              {t.scheduledAt
                ? formatTournamentTime(t.scheduledAt)
                : "Starting now"}
            </p>
            <StatusPill status={t.status} />
          </div>
          <h3 className="font-display mt-1 truncate text-lg leading-tight font-semibold">
            {t.name}
          </h3>
          <p className="truncate text-sm text-zinc-400">
            {t.table.name} · {t.table.smallBlind}/{t.table.bigBlind} blinds
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          <ul className="flex -space-x-2" aria-label={capacityLabel}>
            {Array.from({ length: MAX_SEATS_PER_TABLE }, (_, i) => {
              const player = seated[i];
              return (
                <li key={player?.id ?? `empty-${i}`}>
                  {player ? (
                    <PlayerAvatar
                      player={player}
                      isMe={player.userId === userId}
                      className="size-7"
                    />
                  ) : (
                    <span
                      className="block size-7 rounded-full border border-dashed border-white/20 bg-zinc-900 ring-2 ring-zinc-950"
                      aria-label="Open seat"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {waitlist.length > 0 ? (
            <StandbyList players={waitlist} userId={userId} />
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <div className="min-w-0">{status}</div>
          <div className="flex shrink-0 items-center gap-1">
            {secondary}
            <button className={ghostBtn} onClick={onGoToTable}>
              <Eye className="size-4" /> Watch
            </button>
            {primary}
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: LobbyTournament["status"] }) {
  if (status === "upcoming") return null;
  const live = status === "in_progress";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        live
          ? "bg-amber-400/10 text-amber-300"
          : "bg-emerald-400/10 text-emerald-300"
      }`}
    >
      <span className="relative flex size-1.5">
        <span
          className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${
            live ? "bg-amber-300" : "bg-emerald-300"
          }`}
        />
        <span
          className={`relative inline-flex size-1.5 rounded-full ${
            live ? "bg-amber-300" : "bg-emerald-300"
          }`}
        />
      </span>
      {live ? "Live" : "Open now"}
    </span>
  );
}

function StatusText({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "gold" | "muted";
}) {
  return (
    <p
      className={`flex items-center gap-1.5 truncate text-sm ${
        tone === "gold" ? "text-landing-gold font-medium" : "text-zinc-400"
      }`}
    >
      {children}
    </p>
  );
}

/** "2 on standby" — hover or focus to see who, in order. */
function StandbyList({
  players,
  userId,
}: {
  players: LobbyTournament["registrations"];
  userId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-default text-xs text-zinc-500 underline decoration-zinc-700 decoration-dotted underline-offset-4 outline-none hover:text-zinc-300 focus-visible:text-zinc-300"
        >
          {players.length} on standby
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" sideOffset={6}>
        <ol className="space-y-0.5 py-0.5">
          {players.map((p, i) => (
            <li key={p.id} className="flex gap-2">
              <span className="w-3 text-right text-zinc-500 tabular-nums">
                {i + 1}
              </span>
              <span>
                {p.name}
                {p.userId === userId ? " (you)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </TooltipContent>
    </Tooltip>
  );
}

/** Google photo (or initials) with the player's name on hover. */
function PlayerAvatar({
  player,
  isMe,
  className,
}: {
  player: LobbyTournament["registrations"][number];
  isMe: boolean;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = `${player.name}${isMe ? " (you)" : ""}`;
  const initials = player.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={name}
          className={`relative flex items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300 ring-2 outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-white/60 ${
            isMe ? "ring-landing-gold z-[1]" : "ring-zinc-950"
          } ${className}`}
        >
          {player.image && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Google avatars
            <img
              src={player.image}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initials
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{name}</TooltipContent>
    </Tooltip>
  );
}
