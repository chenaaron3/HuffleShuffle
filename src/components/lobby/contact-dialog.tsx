import { X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api, type RouterOutputs } from "~/utils/api";

type ContactInfo = RouterOutputs["contact"]["get"];
type ContactMethod = NonNullable<ContactInfo["contact"]>["preferredContact"];

const METHODS: { value: ContactMethod; label: string }[] = [
  { value: "phone", label: "Text" },
  { value: "instagram", label: "Instagram" },
  { value: "email", label: "Email" },
];

const inputClassName =
  "w-full min-w-0 rounded-lg border bg-zinc-900/60 px-4 py-3 text-white placeholder:text-zinc-500 outline-none ring-0 focus:border-[#FFD700]/40 disabled:opacity-60";

const primaryButtonClassName =
  "w-full rounded-lg bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

function FieldLabel({
  htmlFor,
  children,
  preferred,
  note,
}: {
  htmlFor?: string;
  children: ReactNode;
  preferred: boolean;
  note: string;
}) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <Tag
      htmlFor={htmlFor}
      className="flex items-baseline gap-2 text-sm font-medium text-zinc-200"
    >
      {children}
      {preferred ? (
        <span className="text-[11px] font-medium tracking-wider text-[#FFD700] uppercase">
          Preferred
        </span>
      ) : (
        <span className="text-xs font-normal text-zinc-500">({note})</span>
      )}
    </Tag>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({
  name,
  image,
  className = "",
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-700 font-semibold text-zinc-200 ${className}`}
    >
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Google avatars
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

/**
 * Collects how we reach a player. In `required` mode the dialog cannot be
 * dismissed until the player saves; otherwise it is a closable editor.
 */
export function ContactDialog({
  open,
  onOpenChange,
  required,
  info,
  userName,
  userImage,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: boolean;
  info: ContactInfo;
  userName: string;
  userImage?: string | null;
  onSaved: (contact: NonNullable<ContactInfo["contact"]>) => void;
}) {
  const fieldId = useId();
  const [preferred, setPreferred] = useState<ContactMethod>("phone");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    if (!open) return;
    setPreferred(info.contact?.preferredContact ?? "phone");
    setPhone(info.contact?.phone ?? "");
    setInstagram(info.contact?.instagram ? `@${info.contact.instagram}` : "");
  }, [open, info.contact]);

  const saveMutation = api.contact.save.useMutation({ onSuccess: onSaved });

  const preferredFilled =
    preferred === "email" ||
    (preferred === "phone" ? phone.trim() : instagram.trim()).length > 0;
  const canSubmit = preferredFilled && !saveMutation.isPending;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    saveMutation.mutate({
      preferredContact: preferred,
      phone: phone.trim() || undefined,
      instagram: instagram.trim() || undefined,
    });
  };

  const blockDismiss = (e: Event) => {
    if (required) e.preventDefault();
  };

  const fieldBorder = (method: ContactMethod) =>
    preferred === method ? "border-[#FFD700]/35" : "border-white/10";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (required && !next) return;
        if (!next) saveMutation.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-[#FFD700]/10 bg-zinc-950 p-6 shadow-[0_0_60px_rgba(212,175,55,0.12)]"
        onEscapeKeyDown={blockDismiss}
        onPointerDownOutside={blockDismiss}
        onInteractOutside={blockDismiss}
      >
        {!required ? (
          <DialogClose className="absolute top-4 right-4 rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        ) : null}

        <DialogHeader className="mb-5 pr-8 text-left">
          <DialogTitle className="text-xl font-semibold text-white">
            {required ? "How should we reach you?" : "Contact info"}
          </DialogTitle>
          <DialogDescription>
            {required
              ? "We’ll use this to confirm seats and send game-day reminders."
              : "Update how we reach you about seats and game days."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex min-w-0 items-center gap-2.5 text-sm text-zinc-500">
            <UserAvatar
              name={userName}
              image={userImage}
              className="size-7 text-[11px]"
            />
            <span className="min-w-0 break-words">
              Signed in as{" "}
              <span className="font-medium text-zinc-200">{userName}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span
              id={`${fieldId}-pref`}
              className="text-sm font-medium text-zinc-200"
            >
              Preferred contact
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`${fieldId}-pref`}
              className="grid grid-cols-3 gap-1 rounded-[10px] border border-white/10 bg-zinc-900/60 p-1"
            >
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={preferred === m.value}
                  onClick={() => setPreferred(m.value)}
                  disabled={saveMutation.isPending}
                  className={`rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD700] ${
                    preferred === m.value
                      ? "bg-[#FFD700] font-medium text-black"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <div className="flex flex-col gap-2">
            <FieldLabel
              htmlFor={`${fieldId}-phone`}
              preferred={preferred === "phone"}
              note="optional"
            >
              Phone number
            </FieldLabel>
            <input
              id={`${fieldId}-phone`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saveMutation.isPending}
              className={`${inputClassName} ${fieldBorder("phone")}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel
              htmlFor={`${fieldId}-instagram`}
              preferred={preferred === "instagram"}
              note="optional"
            >
              Instagram
            </FieldLabel>
            <input
              id={`${fieldId}-instagram`}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              placeholder="@username"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              disabled={saveMutation.isPending}
              className={`${inputClassName} ${fieldBorder("instagram")}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel preferred={preferred === "email"} note="from Google">
              Email
            </FieldLabel>
            <div
              className={`rounded-lg border px-4 py-3 text-sm break-words text-zinc-400 ${
                preferred === "email"
                  ? "border-[#FFD700]/35"
                  : "border-dashed border-white/10"
              }`}
            >
              {info.email}
            </div>
          </div>

          {saveMutation.error ? (
            <p role="alert" className="text-sm text-red-400">
              {saveMutation.error.data?.zodError
                ? Object.values(saveMutation.error.data.zodError.fieldErrors)
                    .flat()
                    .join(" ")
                : saveMutation.error.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={primaryButtonClassName}
          >
            {saveMutation.isPending
              ? "Saving…"
              : required
                ? "Save and continue"
                : "Save"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
