import { useId } from "react";

interface MediaConsentFieldProps {
  recordingConsent: boolean;
  onRecordingConsentChange: (checked: boolean) => void;
  /** null until the player picks Yes or No. */
  socialMediaConsent: boolean | null;
  onSocialMediaConsentChange: (value: boolean) => void;
  disabled?: boolean;
}

const optionClassName =
  "flex cursor-pointer items-center gap-2 text-sm text-zinc-200 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

function PermissionBadge({ value }: { value: boolean | null }) {
  const label = value === null ? "Not set" : value ? "Yes" : "No";
  return (
    <span
      className={
        value === true
          ? "rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-300"
          : "rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300"
      }
    >
      {label}
    </span>
  );
}

interface MediaConsentSummaryProps {
  recordingConsent: boolean;
  socialMediaConsent: boolean | null;
}

/** Read-only view of saved permissions, shown in the join dialog once consent is given. */
export function MediaConsentSummary({
  recordingConsent,
  socialMediaConsent,
}: MediaConsentSummaryProps) {
  return (
    <div className="mt-4 rounded-md border border-white/10 bg-black/40 p-4">
      <p className="text-sm font-medium text-white">
        Your recording &amp; media permissions
      </p>
      <dl className="mt-2 divide-y divide-white/10 text-sm">
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-zinc-300">Game recording consent</dt>
          <dd>
            <PermissionBadge value={recordingConsent} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-zinc-300">Social media &amp; promotional consent</dt>
          <dd>
            <PermissionBadge value={socialMediaConsent} />
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-zinc-500">
        Want to change your permissions? Send an email to{" "}
        <a
          href="mailto:cabreu@huffleshuffle.com"
          className="font-medium text-zinc-300 underline-offset-2 hover:underline"
        >
          cabreu@huffleshuffle.com
        </a>{" "}
        and we&apos;ll update your preferences for you.
      </p>
    </div>
  );
}

/** Player permissions shown in the join dialog until recording consent is given. */
export function MediaConsentField({
  recordingConsent,
  onRecordingConsentChange,
  socialMediaConsent,
  onSocialMediaConsentChange,
  disabled = false,
}: MediaConsentFieldProps) {
  const socialGroupName = useId();

  return (
    <div className="mt-4 space-y-4 rounded-md border border-white/10 bg-black/40 p-4">
      <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
        HuffleShuffle&trade; player permissions
      </p>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={recordingConsent}
          onChange={(e) => onRecordingConsentChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 size-4 shrink-0 accent-white"
        />
        <span className="flex-1">
          I agree to game recording for security, gameplay review, and game
          integrity.
        </span>
        <span className="shrink-0 text-xs text-zinc-500">Required</span>
      </label>

      <fieldset className="space-y-2 border-t border-white/10 pt-4">
        <legend className="text-sm font-medium text-white">
          Can we feature you in HuffleShuffle&trade; content?
        </legend>
        <p className="text-xs text-zinc-400">
          This includes game clips, your image, voice, name, and social media
          handles across our social media channels.
        </p>
        <div className="flex gap-6 pt-1">
          <label className={optionClassName}>
            <input
              type="radio"
              name={socialGroupName}
              checked={socialMediaConsent === true}
              onChange={() => onSocialMediaConsentChange(true)}
              disabled={disabled}
              className="size-4 accent-white"
            />
            Yes, that&apos;s fine
          </label>
          <label className={optionClassName}>
            <input
              type="radio"
              name={socialGroupName}
              checked={socialMediaConsent === false}
              onChange={() => onSocialMediaConsentChange(false)}
              disabled={disabled}
              className="size-4 accent-white"
            />
            No, thanks
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-zinc-500">
        Your choices are saved for future games. You can request changes
        anytime at{" "}
        <a
          href="mailto:cabreu@huffleshuffle.com"
          className="font-medium text-zinc-300 underline-offset-2 hover:underline"
        >
          cabreu@huffleshuffle.com
        </a>
        .
      </p>
    </div>
  );
}
