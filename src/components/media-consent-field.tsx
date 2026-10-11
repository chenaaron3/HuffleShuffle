interface MediaConsentFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Recording & media opt-in shown in the join dialog until the player has consented. */
export function MediaConsentField({
  checked,
  onCheckedChange,
  disabled = false,
}: MediaConsentFieldProps) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-medium text-zinc-200">
        Recording &amp; media consent
      </p>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-black/40 p-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 size-4 shrink-0 accent-white"
        />
        <span>
          I consent to my games being recorded and to that footage being used
          on HuffleShuffle&trade; social media and in promotional content.
        </span>
      </label>
      <p className="text-xs text-zinc-400">
        Required to join a table. Want to change your permissions later? Send an
        email to{" "}
        <a
          href="mailto:cabreu@huffleshuffle.com"
          className="font-medium text-zinc-200 underline-offset-2 hover:underline"
        >
          cabreu@huffleshuffle.com
        </a>{" "}
        and we&apos;ll update your preferences for you.
      </p>
    </div>
  );
}
