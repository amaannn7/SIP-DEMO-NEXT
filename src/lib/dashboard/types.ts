export type RecentLead = {
  id: string;
  company: string;
  contact: string;
  nextAction: string;
  temperature: "on_fire" | "hot" | "warm" | "cold";
};
