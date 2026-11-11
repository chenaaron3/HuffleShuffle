import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AtSign,
  GripVertical,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  contactDisplay,
  type ContactMethod,
  type PreferredContact,
} from "~/lib/contact";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";
import {
  DAY_NAMES,
  formatStartTime,
  formatTournamentTime,
  fromEasternInputValue,
  toEasternInputValue,
} from "~/lib/tournament-schedule";
import { MAX_SEATS_PER_TABLE } from "~/server/db/schema";
import { api, type RouterOutputs } from "~/utils/api";

type Series = RouterOutputs["tournament"]["listSeries"][number];
type Game = RouterOutputs["tournament"]["list"][number];
type TableOption = { id: string; name: string };

const input =
  "h-8 rounded-md border border-white/10 bg-black/50 px-2 text-sm outline-none focus:border-white/30";
const primaryBtn =
  "h-8 rounded-md bg-white px-3 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50";
const iconBtn =
  "rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-50";
const card = "rounded-lg border border-white/10 bg-zinc-900/50 p-3";
const addCard =
  "flex min-h-[4.5rem] items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 text-sm text-zinc-400 hover:border-white/30 hover:text-white";

function useMutationOpts(after?: () => void) {
  const utils = api.useUtils();
  return {
    onSuccess: async () => {
      after?.();
      await Promise.all([
        utils.tournament.list.invalidate(),
        utils.tournament.listSeries.invalidate(),
      ]);
    },
    onError: (error: { message: string }) => alert(error.message),
  };
}

export function TournamentsTab() {
  const { data: tables } = api.table.list.useQuery();
  const { data: series } = api.tournament.listSeries.useQuery();
  const { data: games } = api.tournament.list.useQuery();
  const tableOptions = (tables ?? []).map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-8">
      <Section
        title="Recurring series"
        hint="Each series keeps one upcoming game; next week's is created when it ends or is cancelled. Eastern time."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(series ?? []).map((s) => (
            <SeriesCard key={s.id} series={s} tables={tableOptions} />
          ))}
          <SeriesCard tables={tableOptions} />
        </div>
      </Section>

      <Section
        title="Upcoming games"
        hint="Drag players to reorder. The first 8 are seated."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(games ?? []).map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
          <OneOffCard tables={tableOptions} />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mb-3 text-sm text-zinc-500">{hint}</p>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ series

type SeriesDraft = {
  tableId: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
};

/** Without `series`, renders the "+ New series" card. */
function SeriesCard({
  series,
  tables,
}: {
  series?: Series;
  tables: TableOption[];
}) {
  const [draft, setDraft] = useState<SeriesDraft | null>(null);
  const save = api.tournament.saveSeries.useMutation(
    useMutationOpts(() => setDraft(null)),
  );
  const remove = api.tournament.deleteSeries.useMutation(useMutationOpts());

  const startEditing = () =>
    setDraft(
      series
        ? {
            tableId: series.tableId,
            name: series.name,
            dayOfWeek: series.dayOfWeek,
            startTime: series.startTime,
          }
        : {
            tableId: tables[0]?.id ?? "",
            name: "",
            dayOfWeek: 0,
            startTime: "15:00",
          },
    );

  if (draft) {
    return (
      <div className={`${card} space-y-2`}>
        <input
          autoFocus
          className={`${input} w-full`}
          placeholder="Name, e.g. Sunday 3pm"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <div className="flex gap-2">
          <select
            className={`${input} flex-1`}
            value={draft.dayOfWeek}
            onChange={(e) =>
              setDraft({ ...draft, dayOfWeek: Number(e.target.value) })
            }
          >
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            className={input}
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <TableSelect
            tables={tables}
            value={draft.tableId}
            onChange={(tableId) => setDraft({ ...draft, tableId })}
          />
          <button
            className={primaryBtn}
            disabled={save.isPending || !draft.name.trim() || !draft.tableId}
            onClick={() => save.mutate({ ...draft, seriesId: series?.id })}
          >
            Save
          </button>
          <button
            className={iconBtn}
            aria-label="Cancel"
            onClick={() => setDraft(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <button className={addCard} onClick={startEditing}>
        <Plus className="size-4" /> New series
      </button>
    );
  }

  return (
    <div className={`${card} flex items-start justify-between gap-2`}>
      <div className="min-w-0">
        <p className="truncate font-medium">{series.name}</p>
        <p className="text-sm text-zinc-400">
          {DAY_NAMES[series.dayOfWeek]?.slice(0, 3)}{" "}
          {formatStartTime(series.startTime)} · {series.table.name}
        </p>
      </div>
      <div className="flex shrink-0">
        <button
          className={iconBtn}
          aria-label="Edit series"
          onClick={startEditing}
        >
          <Pencil className="size-4" />
        </button>
        <button
          className={iconBtn}
          aria-label="Delete series"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Delete "${series.name}" and its upcoming game?`)) {
              remove.mutate({ seriesId: series.id });
            }
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ games

function GameCard({ game }: { game: Game }) {
  const [editing, setEditing] = useState<{ name: string; when: string } | null>(
    null,
  );
  const [email, setEmail] = useState("");

  const update = api.tournament.update.useMutation(
    useMutationOpts(() => setEditing(null)),
  );
  const cancel = api.tournament.cancel.useMutation(useMutationOpts());
  const removePlayer =
    api.tournament.removePlayer.useMutation(useMutationOpts());
  const movePlayer = api.tournament.movePlayer.useMutation(useMutationOpts());
  const addPlayer = api.tournament.addPlayer.useMutation(
    useMutationOpts(() => setEmail("")),
  );
  const editable = game.status !== "in_progress";

  return (
    <div className={card}>
      {editing ? (
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            autoFocus
            className={`${input} min-w-0 flex-1`}
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <input
            type="datetime-local"
            className={input}
            value={editing.when}
            onChange={(e) => setEditing({ ...editing, when: e.target.value })}
          />
          <button
            className={primaryBtn}
            disabled={update.isPending || !editing.name.trim() || !editing.when}
            onClick={() =>
              update.mutate({
                tournamentId: game.id,
                name: editing.name,
                scheduledAt: fromEasternInputValue(editing.when),
              })
            }
          >
            Save
          </button>
          <button
            className={iconBtn}
            aria-label="Cancel"
            onClick={() => setEditing(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {game.name}
              {game.status !== "upcoming" ? (
                <span
                  className={`ml-2 text-xs ${game.status === "open" ? "text-green-400" : "text-amber-400"}`}
                >
                  {game.status === "open" ? "● Open" : "● In progress"}
                </span>
              ) : null}
            </p>
            <p className="text-sm text-zinc-400">
              {game.scheduledAt
                ? formatTournamentTime(game.scheduledAt)
                : "Now"}{" "}
              · {game.table.name}
            </p>
          </div>
          {editable ? (
            <div className="flex shrink-0">
              <button
                className={iconBtn}
                aria-label="Edit game"
                onClick={() =>
                  setEditing({
                    name: game.name,
                    when: game.scheduledAt
                      ? toEasternInputValue(game.scheduledAt)
                      : "",
                  })
                }
              >
                <Pencil className="size-4" />
              </button>
              <button
                className={iconBtn}
                aria-label="Cancel game"
                disabled={cancel.isPending}
                onClick={() => {
                  if (confirm(`Cancel ${game.name}?`)) {
                    cancel.mutate({ tournamentId: game.id });
                  }
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      <p className="mb-1 text-xs tracking-wide text-zinc-500 uppercase">
        Seated {Math.min(game.registrations.length, MAX_SEATS_PER_TABLE)}/
        {MAX_SEATS_PER_TABLE}
        {game.registrations.length > MAX_SEATS_PER_TABLE
          ? ` · Standby ${game.registrations.length - MAX_SEATS_PER_TABLE}`
          : ""}
      </p>
      <PlayerQueue
        registrations={game.registrations}
        sortable={editable}
        onMove={(registrationId, toIndex) =>
          movePlayer.mutate({ registrationId, toIndex })
        }
        onRemove={(registrationId) => removePlayer.mutate({ registrationId })}
        removing={removePlayer.isPending}
      />

      {editable ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addPlayer.mutate({ tournamentId: game.id, email });
          }}
        >
          <input
            type="email"
            className={`${input} min-w-0 flex-1`}
            placeholder="Add player by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className={primaryBtn}
            disabled={!email || addPlayer.isPending}
          >
            Add
          </button>
        </form>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ queue

type Registration = Game["registrations"][number];

function PlayerQueue({
  registrations,
  sortable,
  onMove,
  onRemove,
  removing,
}: {
  registrations: Registration[];
  sortable: boolean;
  onMove: (registrationId: string, toIndex: number) => void;
  onRemove: (registrationId: string) => void;
  removing: boolean;
}) {
  // Local copy so a drop reorders instantly; resyncs when the server list changes.
  const [items, setItems] = useState(registrations);
  const serverOrder = registrations.map((r) => r.id).join();
  const [syncedOrder, setSyncedOrder] = useState(serverOrder);
  if (serverOrder !== syncedOrder) {
    setSyncedOrder(serverOrder);
    setItems(registrations);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((r) => r.id === active.id);
    const to = items.findIndex((r) => r.id === over.id);
    setItems(arrayMove(items, from, to));
    onMove(String(active.id), to);
  };

  if (items.length === 0) {
    return <p className="py-1 text-sm text-zinc-600">No one yet</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ol className="relative">
          {items.map((r, i) => (
            <QueueRow
              key={r.id}
              registration={r}
              position={i + 1}
              sortable={sortable}
              onRemove={() => onRemove(r.id)}
              removing={removing}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function QueueRow({
  registration: r,
  position,
  sortable,
  onRemove,
  removing,
}: {
  registration: Registration;
  position: number;
  sortable: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: r.id, disabled: !sortable });
  const waitlisted = position > MAX_SEATS_PER_TABLE;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-center gap-1.5 rounded px-1 py-0.5 text-sm ${
        isDragging
          ? "z-10 bg-zinc-800 shadow-lg ring-1 shadow-black/60 ring-white/15"
          : "hover:bg-white/5"
      }`}
    >
      {sortable ? (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${r.name}`}
          className={`shrink-0 touch-none text-zinc-600 hover:text-zinc-300 ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}
      <span className="w-5 shrink-0 text-right text-zinc-500">{position}</span>
      <span className={`truncate ${waitlisted ? "text-zinc-400" : ""}`}>
        {r.name}
      </span>
      {r.contact ? <ContactLink contact={r.contact} /> : null}
      {waitlisted ? (
        <span className="shrink-0 text-xs text-zinc-500">standby</span>
      ) : null}
      {r.isAtTable ? (
        <span className="shrink-0 text-xs text-green-400">at table</span>
      ) : null}
      <button
        className={`${iconBtn} ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100`}
        aria-label={`Remove ${r.name}`}
        disabled={removing}
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

const CONTACT_ICONS: Record<ContactMethod, typeof Mail> = {
  phone: MessageSquare,
  instagram: AtSign,
  email: Mail,
};

const CONTACT_LABELS: Record<ContactMethod, string> = {
  phone: "Text",
  instagram: "Instagram",
  email: "Email",
};

/** A registrant's preferred contact; clicking copies it to the clipboard. */
function ContactLink({ contact }: { contact: PreferredContact }) {
  const Icon = CONTACT_ICONS[contact.method];
  const label = CONTACT_LABELS[contact.method];
  const display = contactDisplay(contact);
  const copy = () => {
    navigator.clipboard.writeText(display).then(
      () => toast.success(`Copied ${display}`),
      () => toast.error("Couldn't copy to clipboard"),
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`${label}: ${display} (click to copy)`}
      aria-label={`Copy ${label.toLowerCase()} ${display}`}
      className="flex min-w-0 cursor-copy items-center gap-1 rounded text-xs text-zinc-500 hover:text-zinc-200 focus-visible:outline-1 focus-visible:outline-white/40"
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{display}</span>
    </button>
  );
}

function OneOffCard({ tables }: { tables: TableOption[] }) {
  const [draft, setDraft] = useState<{
    name: string;
    when: string;
    tableId: string;
  } | null>(null);
  const create = api.tournament.create.useMutation(
    useMutationOpts(() => setDraft(null)),
  );

  if (!draft) {
    return (
      <button
        className={addCard}
        onClick={() =>
          setDraft({ name: "", when: "", tableId: tables[0]?.id ?? "" })
        }
      >
        <Plus className="size-4" /> One-off game
      </button>
    );
  }
  return (
    <div className={`${card} space-y-2`}>
      <input
        autoFocus
        className={`${input} w-full`}
        placeholder="Name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="datetime-local"
          className={input}
          value={draft.when}
          onChange={(e) => setDraft({ ...draft, when: e.target.value })}
        />
        <TableSelect
          tables={tables}
          value={draft.tableId}
          onChange={(tableId) => setDraft({ ...draft, tableId })}
        />
        <button
          className={primaryBtn}
          disabled={
            create.isPending ||
            !draft.name.trim() ||
            !draft.when ||
            !draft.tableId
          }
          onClick={() =>
            create.mutate({
              tableId: draft.tableId,
              name: draft.name,
              scheduledAt: fromEasternInputValue(draft.when),
            })
          }
        >
          Create
        </button>
        <button
          className={iconBtn}
          aria-label="Cancel"
          onClick={() => setDraft(null)}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function TableSelect({
  tables,
  value,
  onChange,
}: {
  tables: TableOption[];
  value: string;
  onChange: (tableId: string) => void;
}) {
  return (
    <select
      className={`${input} min-w-0 flex-1`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {tables.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
