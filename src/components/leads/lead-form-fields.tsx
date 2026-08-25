type LeadFormValues = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  industry?: string | null;
  country?: string | null;
  website?: string | null;
  linkedin?: string | null;
  companySize?: string | null;
  notes?: string | null;
};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export function LeadFormFields({ defaultValues }: { defaultValues?: LeadFormValues }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" defaultValue={defaultValues?.firstName ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" defaultValue={defaultValues?.lastName ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="phone">Phone</label>
        <input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="company">Company</label>
        <input id="company" name="company" defaultValue={defaultValues?.company ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={defaultValues?.title ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="industry">Industry</label>
        <input id="industry" name="industry" defaultValue={defaultValues?.industry ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="country">Country</label>
        <input id="country" name="country" defaultValue={defaultValues?.country ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="website">Website</label>
        <input id="website" name="website" defaultValue={defaultValues?.website ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="linkedin">LinkedIn</label>
        <input id="linkedin" name="linkedin" defaultValue={defaultValues?.linkedin ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="companySize">Company size</label>
        <input id="companySize" name="companySize" defaultValue={defaultValues?.companySize ?? ""} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaultValues?.notes ?? ""}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
        />
      </div>
    </div>
  );
}
