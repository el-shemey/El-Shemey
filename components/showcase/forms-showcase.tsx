import {
  Checkbox,
  FormField,
  Input,
  Radio,
  SearchField,
  Select,
  Switch,
  Textarea,
} from "@/components/ui/form";

export function FormsShowcase() {
  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
      <FormField
        label="Full name"
        htmlFor="f-name"
        hint="Shown on your profile and certificates."
      >
        <Input id="f-name" placeholder="Shimy Ibrahim" autoComplete="name" />
      </FormField>

      <FormField
        label="Email"
        htmlFor="f-email"
        error="That doesn't look like an email address."
      >
        <Input id="f-email" type="email" defaultValue="shimy@" invalid />
      </FormField>

      <FormField label="Display name" htmlFor="f-ok" success="Looks good.">
        <Input id="f-ok" defaultValue="shimy.dev" valid />
      </FormField>

      <FormField
        label="Password"
        htmlFor="f-pass"
        hint="At least 10 characters — a passphrase works best."
      >
        <Input id="f-pass" type="password" defaultValue="correct-horse-battery" />
      </FormField>

      <FormField label="Learning goal" htmlFor="f-goal" className="lg:col-span-1">
        <Select id="f-goal" defaultValue="automation">
          <option value="prompting">Prompt engineering</option>
          <option value="automation">AI automation & n8n</option>
          <option value="agents">Building AI agents</option>
        </Select>
      </FormField>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Search the library</span>
        <SearchField label="Search courses" />
      </div>

      <FormField
        label="Project brief"
        htmlFor="f-brief"
        hint="Arabic and English both work fine here."
      >
        <Textarea
          id="f-brief"
          dir="rtl"
          lang="ar"
          className="text-right font-arabic"
          placeholder="عايز أبني أتمتة بتبعت تقرير أسبوعي على الإيميل…"
        />
      </FormField>

      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-sm font-medium">Preferences</legend>
        <Checkbox label="Email me new lessons" defaultChecked />
        <Checkbox label="Weekly progress digest" />
        <div
          role="radiogroup"
          aria-label="Contact language"
          className="flex gap-6 pt-2"
        >
          <Radio label="English" name="lang-demo" defaultChecked />
          <Radio label="العربية" name="lang-demo" />
        </div>
        <div className="flex flex-wrap gap-8 pt-2">
          <Switch label="Public profile" defaultChecked />
          <Switch label="Reduced motion hints" />
        </div>
      </fieldset>
    </div>
  );
}
