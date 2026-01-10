import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, Copy, Download, ExternalLink } from "lucide-react";
import { SetupConfig } from "../SetupWizard";

interface CompleteStepProps {
  config: SetupConfig;
  onBack: () => void;
}

export function CompleteStep({ config, onBack }: CompleteStepProps) {
  const [copied, setCopied] = useState(false);

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
          Save your configuration and start using SQL Query Manager
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
            <dt className="text-muted-foreground">Email Domain:</dt>
            <dd className="font-medium">{config.allowedEmailDomain}</dd>
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

      {/* Next Steps */}
      <div className="p-4 rounded-lg border">
        <h3 className="font-medium mb-3">Next Steps</h3>
        <ol className="space-y-2 text-sm list-decimal list-inside">
          {config.provider === "rest" ? (
            <>
              <li>Save the .env file to your project root</li>
              <li>
                Run <code className="px-1 py-0.5 bg-muted rounded">docker compose up -d</code> to
                start the database
              </li>
              <li>
                Run <code className="px-1 py-0.5 bg-muted rounded">npm run dev</code> to start the
                application
              </li>
              <li>Create your first team and invite members</li>
            </>
          ) : (
            <>
              <li>Save the .env file to your project root</li>
              <li>
                Run the database migrations in{" "}
                <a
                  href="https://supabase.com/docs/guides/cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Supabase Studio
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Run <code className="px-1 py-0.5 bg-muted rounded">npm run dev</code> to start the
                application
              </li>
              <li>Sign in with your Supabase auth and create a team</li>
            </>
          )}
        </ol>
      </div>

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
    lines.push("VITE_AUTH_PROVIDERS=supabase");
  } else {
    lines.push("# Self-Hosted REST Configuration");
    lines.push("VITE_DB_PROVIDER=rest");
    lines.push("VITE_API_BASE_URL=http://localhost:8787");
    lines.push("VITE_AUTH_PROVIDERS=local");
    lines.push("");
    lines.push("# Docker Compose / Backend");
    lines.push("POSTGRES_PASSWORD=change-this-password");
    lines.push("POSTGRES_DB=sqlquerymanager");
    lines.push("DATABASE_URL=postgres://postgres:change-this-password@localhost:5432/sqlquerymanager");
  }

  lines.push("");
  lines.push("# Authentication Configuration");
  lines.push(`VITE_ALLOWED_EMAIL_DOMAIN=${config.allowedEmailDomain}`);
  lines.push("");
  lines.push("# Application Branding");
  lines.push(`VITE_APP_NAME=${config.appName}`);
  lines.push(`VITE_APP_DESCRIPTION=${config.appDescription}`);

  return lines.join("\n");
}
