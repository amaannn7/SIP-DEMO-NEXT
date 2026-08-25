import { TemperatureBadge } from "@/components/leads/temperature-badge";
import type { RecentLead } from "@/lib/dashboard/types";

export function RecentLeadsTable({ leads }: { leads: RecentLead[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11px] font-medium text-muted-foreground">
          <th className="pb-2 font-medium">Contact</th>
          <th className="pb-2 font-medium">Next Action</th>
          <th className="pb-2 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {leads.map((lead) => (
          <tr key={lead.id} className="row-hover cursor-pointer">
            <td className="py-2.5 pl-1 first:rounded-l-md">
              <p className="font-medium text-foreground">{lead.company}</p>
              <p className="text-xs text-muted-foreground">{lead.contact}</p>
            </td>
            <td className="py-2.5 text-muted-foreground">{lead.nextAction}</td>
            <td className="py-2.5 pr-1 text-right last:rounded-r-md">
              <TemperatureBadge temperature={lead.temperature} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
