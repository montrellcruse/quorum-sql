import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Mail, Shield } from "lucide-react";
import { SetupConfig } from "../SetupWizard";

interface ConfigurationStepProps {
  config: SetupConfig;
  onUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConfigurationStep({ config, onUpdate, onNext, onBack }: ConfigurationStepProps) {
  // At least one auth provider must be selected
  const hasAuthProvider = config.authProviders.length > 0;
  // Domain is only required if domain lock is enabled
  const isDomainValid = !config.requireDomainLock || config.allowedEmailDomain.trim() !== "";
  const isValid = hasAuthProvider && isDomainValid;

  const toggleAuthProvider = (provider: "google" | "email") => {
    const current = config.authProviders;
    if (current.includes(provider)) {
      // Don't allow removing the last provider
      if (current.length > 1) {
        onUpdate({ authProviders: current.filter(p => p !== provider) });
      }
    } else {
      onUpdate({ authProviders: [...current, provider] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configure Your Instance</h2>
        <p className="text-muted-foreground">
          Set up your organization settings
        </p>
      </div>

      <div className="space-y-6 mt-6">
        {/* Authentication Providers */}
        <div className="space-y-3">
          <Label>Authentication Methods *</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Select how users can sign in. At least one method is required.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => toggleAuthProvider("google")}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                config.authProviders.includes("google")
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <div className="text-left">
                <div className="font-medium">Google OAuth</div>
                <div className="text-xs text-muted-foreground">Sign in with Google</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => toggleAuthProvider("email")}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                config.authProviders.includes("email")
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
            >
              <Mail className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Email/Password</div>
                <div className="text-xs text-muted-foreground">Traditional login</div>
              </div>
            </button>
          </div>
          {!hasAuthProvider && (
            <p className="text-xs text-destructive">
              At least one authentication method must be selected.
            </p>
          )}
        </div>

        {/* Domain Restriction Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="domainLock" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Domain Restriction
              </Label>
              <p className="text-xs text-muted-foreground">
                Limit sign-ups to a specific email domain
              </p>
            </div>
            <button
              type="button"
              id="domainLock"
              role="switch"
              aria-checked={config.requireDomainLock}
              onClick={() => onUpdate({ requireDomainLock: !config.requireDomainLock })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.requireDomainLock ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.requireDomainLock ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Email Domain - only shown when domain lock is enabled */}
        {config.requireDomainLock && (
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
            </p>
            {config.requireDomainLock && !config.allowedEmailDomain.trim() && (
              <p className="text-xs text-destructive">
                Domain is required when domain restriction is enabled.
              </p>
            )}
          </div>
        )}

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
