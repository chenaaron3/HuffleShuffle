export type ContactMethod = "phone" | "instagram" | "email";

export type PreferredContact = {
  method: ContactMethod;
  /** Normalized value: E.164 phone, bare Instagram handle, or email. */
  value: string;
};

type ContactRow = {
  phone: string | null;
  instagram: string | null;
  preferredContact: ContactMethod;
} | null;

/**
 * The value to reach a player at. Players who haven't saved contact info yet
 * fall back to their sign-in email.
 */
export function resolvePreferredContact(
  contact: ContactRow,
  email: string,
): PreferredContact {
  if (contact?.preferredContact === "phone" && contact.phone) {
    return { method: "phone", value: contact.phone };
  }
  if (contact?.preferredContact === "instagram" && contact.instagram) {
    return { method: "instagram", value: contact.instagram };
  }
  return { method: "email", value: email };
}

/** "+14155550142" → "(415) 555-0142"; other numbers are returned as stored. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function contactDisplay({ method, value }: PreferredContact): string {
  if (method === "phone") return formatPhone(value);
  if (method === "instagram") return `@${value}`;
  return value;
}
