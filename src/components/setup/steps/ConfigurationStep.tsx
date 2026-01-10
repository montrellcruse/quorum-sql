import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SetupConfig } from "../SetupWizard";

interface ConfigurationStepProps {
  config: SetupConfig;
  onUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConfigurationStep({ config, onUpdate, onNext, onBack }: ConfigurationStepProps) {
  const isValid = config.allowedEmailDomain.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configure Your Instance</h2>
        <p className="text-muted-foreground">
          Set up your organization settings
        </p>
      </div>

      <div className="space-y-6 mt-6">
        {/* Email Domain */}
        <div className="space-y-2">
          <Label htmlFor="emailDomain">Allowed Email Domain *</Label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-muted-foreground">
              @
            </span>
            <Input
              id="emailDomain"
              placeholder="yourcompany.com"
              className="rounded-l-none"
              value={config.allowedEmailDomain.replace(/^@/, "")}
              onChange={(e) => onUpdate({ allowedEmailDomain: `@${e.target.value.replace(/^@/, "")}` })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Only users with email addresses from this domain can access the application.
            Leave empty to allow any email (not recommended for production).
          </p>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <Label htmlFor="appName">Application Name</Label>
          <Input
            id="appName"
            placeholder="SQL Query Manager"
            value={config.appName}
            onChange={(e) => onUpdate({ appName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Displayed in the header and browser title
          </p>
        </div>

        {/* App Description */}
        <div className="space-y-2">
          <Label htmlFor="appDescription">Application Description</Label>
          <Input
            id="appDescription"
            placeholder="Organize and manage your SQL queries securely"
            value={config.appDescription}
            onChange={(e) => onUpdate({ appDescription: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Shown on the landing page and login screen
          </p>
        </div>
      </div>

      <div className="pt-6 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!isValid}>
          Continue
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
