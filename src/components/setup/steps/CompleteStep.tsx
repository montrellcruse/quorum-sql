import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, Copy, Download, ExternalLink, AlertCircle, Terminal } from "lucide-react";
import { SetupConfig } from "../SetupWizard";

interface CompleteStepProps {
  config: SetupConfig;
  onBack: () => void;
}

export function CompleteStep({ config, onBack }: CompleteStepProps) {
  const [copied, setCopied] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);

  const envContent = generateEnvContent(config);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([envContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyDocker = async () => {
    await navigator.clipboard.writeText("docker compose up -d");
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2000);
  };

  const handleCopyMigration = async () => {
    await navigator.clipboard.writeText("npm run migrations:combine");
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  const handleFinish = () => {
    // Store setup completion flag
    localStorage.setItem("setup_complete", "true");
    // Redirect to home
    window.location.href = "/";
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Setup Complete!</h2>
        <p className="text-muted-foreground">
          Save your configuration and start using Quorum
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="p-4 rounded-lg border bg-muted/50">
        <h3 className="font-medium mb-3">Configuration Summary</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Database Provider:</dt>
            <dd className="font-medium">
              {config.provider === "supabase" ? "Supabase Cloud" : "Self-Hosted (REST)"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Auth Methods:</dt>
            <dd className="font-medium">
              {config.authProviders.map(p => p === "google" ? "Google" : "Email/Password").join(", ")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Domain Restriction:</dt>
            <dd className="font-medium">
              {config.requireDomainLock ? config.allowedEmailDomain : "Disabled"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">App Name:</dt>
            <dd className="font-medium">{config.appName}</dd>
          </div>
        </dl>
      </div>

      {/* Environment File */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Environment Configuration</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="w-4 h-4 mr-1" />
              ) : (
                <Copy className="w-4 h-4 mr-1" />
              )}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1" />
              Download .env
            </Button>
          </div>
        </div>
        <pre className="p-4 rounded-lg bg-slate-950 text-slate-50 text-xs overflow-x-auto max-h-48 overflow-y-auto">
          {envContent}
        </pre>
        <p className="text-xs text-muted-foreground">
          Save this as <code className="px-1 py-0.5 bg-muted rounded">.env</code> in the project
          root directory.
        </p>
      </div>

      {/* Next Steps - Provider Specific */}
      {config.provider === "rest" ? (
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600" />
            Docker Setup (One Command)
          </h3>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">1</span>
              <span>Save the .env file to your project root</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">2</span>
              <div className="flex-1">
                <span>Start the database and server:</span>
                <div className="flex items-center justify-between mt-2 p-2 rounded bg-slate-900 text-slate-50">
                  <code className="text-sm">docker compose up -d</code>
                  <Button variant="ghost" size="sm" onClick={handleCopyDocker} className="h-7 text-slate-400 hover:text-slate-50">
                    {copiedDocker ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Migrations and seed data apply automatically
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">3</span>
              <span>Run <code className="px-1 py-0.5 bg-muted rounded">npm run dev</code> and sign in</span>
            </li>
          </ol>
        </div>
      ) : (
        <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Database Migrations Required
          </h3>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-medium">1</span>
              <span>Save the .env file to your project root</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-medium">2</span>
              <div className="flex-1">
                <span>Generate combined migration file:</span>
                <div className="flex items-center justify-between mt-2 p-2 rounded bg-slate-900 text-slate-50">
                  <code className="text-sm">npm run migrations:combine</code>
                  <Button variant="ghost" size="sm" onClick={handleCopyMigration} className="h-7 text-slate-400 hover:text-slate-50">
                    {copiedMigration ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-medium">3</span>
              <div className="flex-1">
                <span>Open{" "}
                  <a
                    href={`https://supabase.com/dashboard/project/${config.supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1] || '_'}/sql/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Supabase SQL Editor
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-medium">4</span>
              <span>Paste contents of <code className="px-1 py-0.5 bg-muted rounded">supabase/combined-migrations.sql</code> and click "Run"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-medium">5</span>
              <span>Run <code className="px-1 py-0.5 bg-muted rounded">npm run dev</code> and sign in with Supabase auth</span>
            </li>
          </ol>
        </div>
      )}

      <div className="pt-6 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button onClick={handleFinish}>
          Launch Application
          <ExternalLink className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function generateEnvContent(config: SetupConfig): string {
  const lines: string[] = [];

  if (config.provider === "supabase") {
    lines.push("# Supabase Configuration");
    lines.push(`VITE_SUPABASE_URL=${config.supabaseUrl || ""}`);
    lines.push(`VITE_SUPABASE_PUBLISHABLE_KEY=${config.supabaseAnonKey || ""}`);
    lines.push(
      `VITE_SUPABASE_PROJECT_ID=${config.supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1] || ""}`
    );
    lines.push("");
    lines.push("# Provider Switch");
    lines.push("VITE_DB_PROVIDER=supabase");
  } else {
    lines.push("# Self-Hosted REST Configuration");
    lines.push("VITE_DB_PROVIDER=rest");
    lines.push("VITE_API_BASE_URL=http://localhost:8787");
    lines.push("");
    lines.push("# Docker Compose / Backend");
    lines.push("POSTGRES_PASSWORD=change-this-password");
    lines.push("POSTGRES_DB=sqlquerymanager");
    lines.push("DATABASE_URL=postgres://postgres:change-this-password@localhost:5432/sqlquerymanager");
  }

  lines.push("");
  lines.push("# Authentication Configuration");
  // Generate auth providers based on user selection
  lines.push(`VITE_AUTH_PROVIDERS=${config.authProviders.join(",")}`);

  // Only include domain restriction if enabled
  if (config.requireDomainLock && config.allowedEmailDomain.trim()) {
    lines.push(`VITE_ALLOWED_EMAIL_DOMAIN=${config.allowedEmailDomain}`);
  } else {
    lines.push("# VITE_ALLOWED_EMAIL_DOMAIN=@yourcompany.com  # Uncomment to restrict sign-ups");
  }

  lines.push("");
  lines.push("# Application Branding");
  lines.push(`VITE_APP_NAME=${config.appName}`);
  lines.push(`VITE_APP_DESCRIPTION=${config.appDescription}`);

  return lines.join("\n");
}
