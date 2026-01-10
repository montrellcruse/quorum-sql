import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Cloud, Server } from "lucide-react";
import { SetupConfig } from "../SetupWizard";

interface DatabaseStepProps {
  config: SetupConfig;
  onUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DatabaseStep({ config, onUpdate, onNext, onBack }: DatabaseStepProps) {
  const isValid =
    config.provider === "rest" ||
    (config.provider === "supabase" && config.supabaseUrl && config.supabaseAnonKey);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Database</h2>
        <p className="text-muted-foreground">
          Select how you want to store your data
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        <ProviderOption
          icon={Server}
          title="Self-Hosted"
          description="Run PostgreSQL locally via Docker. Full control, no external services."
          selected={config.provider === "rest"}
          onClick={() => onUpdate({ provider: "rest" })}
          recommended
        />
        <ProviderOption
          icon={Cloud}
          title="Supabase Cloud"
          description="Use Supabase for managed PostgreSQL with built-in auth."
          selected={config.provider === "supabase"}
          onClick={() => onUpdate({ provider: "supabase" })}
        />
      </div>

      {config.provider === "supabase" && (
        <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Create a free project at{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              supabase.com
            </a>
            , then enter your project details:
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="supabaseUrl">Project URL</Label>
              <Input
                id="supabaseUrl"
                placeholder="https://your-project.supabase.co"
                value={config.supabaseUrl || ""}
                onChange={(e) => onUpdate({ supabaseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabaseKey">Anon/Public Key</Label>
              <Input
                id="supabaseKey"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.supabaseAnonKey || ""}
                onChange={(e) => onUpdate({ supabaseAnonKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Found in Project Settings → API → anon/public key
              </p>
            </div>
          </div>
        </div>
      )}

      {config.provider === "rest" && (
        <div className="p-4 rounded-lg border bg-muted/50">
          <p className="text-sm text-muted-foreground">
            The self-hosted option uses Docker to run PostgreSQL and a REST API server.
            No additional configuration needed - it will run on{" "}
            <code className="px-1 py-0.5 bg-muted rounded text-xs">localhost:8787</code>
          </p>
        </div>
      )}

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

function ProviderOption({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
  recommended,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 text-left transition-colors
        ${selected ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}
      `}
    >
      {recommended && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
          Recommended
        </span>
      )}
      <div className={`p-2 rounded-md ${selected ? "bg-primary/10 text-primary" : "bg-muted"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
