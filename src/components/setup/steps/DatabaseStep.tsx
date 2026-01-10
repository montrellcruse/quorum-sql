import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Cloud, Server, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { SetupConfig } from "../SetupWizard";

interface DatabaseStepProps {
  config: SetupConfig;
  onUpdate: (updates: Partial<SetupConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface TestResult {
  ok: boolean;
  message?: string;
  error?: string;
}

function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname.endsWith(".supabase.co") ||
        parsed.hostname.endsWith(".supabase.in"))
    );
  } catch {
    return false;
  }
}

function isValidSupabaseKey(key: string): boolean {
  if (!key) return false;
  // Supabase anon keys are JWTs starting with 'eyJ' (base64 encoded header)
  return key.startsWith("eyJ") && key.length > 100;
}

export function DatabaseStep({ config, onUpdate, onNext, onBack }: DatabaseStepProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const urlValid = !config.supabaseUrl || isValidSupabaseUrl(config.supabaseUrl);
  const keyValid = !config.supabaseAnonKey || isValidSupabaseKey(config.supabaseAnonKey);

  const canTest =
    config.provider === "supabase" &&
    config.supabaseUrl &&
    isValidSupabaseUrl(config.supabaseUrl) &&
    config.supabaseAnonKey &&
    isValidSupabaseKey(config.supabaseAnonKey);

  const isValid =
    config.provider === "rest" ||
    (config.provider === "supabase" &&
      config.supabaseUrl &&
      isValidSupabaseUrl(config.supabaseUrl) &&
      config.supabaseAnonKey &&
      isValidSupabaseKey(config.supabaseAnonKey));

  const handleTestConnection = async () => {
    if (!canTest) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/setup/test-supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: config.supabaseUrl,
          anonKey: config.supabaseAnonKey,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  };

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
                className={!urlValid ? "border-destructive" : ""}
              />
              {!urlValid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  URL should be https://your-project.supabase.co
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabaseKey">Anon/Public Key</Label>
              <Input
                id="supabaseKey"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.supabaseAnonKey || ""}
                onChange={(e) => onUpdate({ supabaseAnonKey: e.target.value })}
                className={!keyValid ? "border-destructive" : ""}
              />
              {!keyValid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Invalid key format - should start with "eyJ" and be 100+ characters
                </p>
              )}
              {keyValid && (
                <p className="text-xs text-muted-foreground">
                  Found in Project Settings → API → anon/public key
                </p>
              )}
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="pt-2 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!canTest || testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            {testResult && (
              <div
                className={`p-3 rounded-md text-sm flex items-center gap-2 ${
                  testResult.ok
                    ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                }`}
              >
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Connection successful</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{testResult.error || "Connection failed"}</span>
                  </>
                )}
              </div>
            )}
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
