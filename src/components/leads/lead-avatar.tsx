import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

export function LeadAvatar({
  firstName,
  lastName,
  size = "default",
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback className="bg-[var(--accent)]/12 font-semibold text-[var(--accent)]">
        {initials(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  );
}
