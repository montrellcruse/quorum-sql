import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronLeft, ChevronRight, Database, Settings, Shield, Sparkles } from "lucide-react";
import { WelcomeStep } from "./steps/WelcomeStep";
import { DatabaseStep } from "./steps/DatabaseStep";
import { ConfigurationStep } from "./steps/ConfigurationStep";
import { CompleteStep } from "./steps/CompleteStep";

export interface SetupConfig {
  provider: "supabase" | "rest";
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  restApiUrl?: string;
  allowedEmailDomain: string;
  appName: string;
  appDescription: string;
}

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "database", title: "Database", icon: Database },
  { id: "configuration", title: "Settings", icon: Settings },
  { id: "complete", title: "Complete", icon: Check },
];

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<SetupConfig>({
    provider: "rest",
    allowedEmailDomain: "",
    appName: "SQL Query Manager",
    appDescription: "Organize and manage your SQL queries securely",
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfigUpdate = (updates: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case "welcome":
        return <WelcomeStep onNext={handleNext} />;
      case "database":
        return (
          <DatabaseStep
            config={config}
            onUpdate={handleConfigUpdate}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case "configuration":
        return (
          <ConfigurationStep
            config={config}
            onUpdate={handleConfigUpdate}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case "complete":
        return <CompleteStep config={config} onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isComplete = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                      ${isComplete ? "bg-primary border-primary text-primary-foreground" : ""}
                      ${isCurrent ? "border-primary text-primary" : ""}
                      ${!isComplete && !isCurrent ? "border-muted text-muted-foreground" : ""}
                    `}
                  >
                    {isComplete ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-16 sm:w-24 h-0.5 mx-2 transition-colors ${
                        index < currentStep ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step, index) => (
              <span
                key={step.id}
                className={`text-xs sm:text-sm ${
                  index === currentStep ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Help text */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help? Check out the{" "}
          <a
            href="https://github.com/montrellcruse/daas-bi-sql-hub#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            documentation
          </a>
        </p>
      </div>
    </div>
  );
}
