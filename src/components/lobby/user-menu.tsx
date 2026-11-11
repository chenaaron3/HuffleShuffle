import { Contact, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { UserAvatar } from "~/components/lobby/contact-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const itemClassName =
  "cursor-pointer px-2.5 py-2 text-zinc-200 focus:bg-white/10 focus:text-white [&_svg]:text-zinc-400";

/** Avatar button in the lobby header that opens the account menu. */
export function UserMenu({
  name,
  email,
  image,
  contactDisabled,
  onEditContact,
}: {
  name: string;
  email?: string | null;
  image?: string | null;
  contactDisabled: boolean;
  onEditContact: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full ring-2 ring-[#FFD700]/50 ring-offset-2 ring-offset-black transition outline-none hover:ring-[#FFD700] focus-visible:ring-[#FFD700] data-[state=open]:ring-[#FFD700]"
      >
        <UserAvatar name={name} image={image} className="size-9 text-xs" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-56 rounded-lg border-white/10 bg-zinc-950 text-white shadow-[0_0_40px_rgba(212,175,55,0.10)]"
      >
        <DropdownMenuLabel className="min-w-0 px-2.5 py-2 font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          {email ? (
            <p className="truncate text-xs text-zinc-500">{email}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className={itemClassName}
          disabled={contactDisabled}
          onSelect={onEditContact}
        >
          <Contact aria-hidden />
          Contact
        </DropdownMenuItem>
        <DropdownMenuItem
          className={itemClassName}
          onSelect={() => void signOut({ callbackUrl: "/" })}
        >
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
