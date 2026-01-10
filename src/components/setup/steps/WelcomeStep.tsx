import { Button } from "@/components/ui/button";
import { Database, GitBranch, Shield, Users } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Quorum
        </h1>
        <p className="text-muted-foreground">
          A team-based SQL query management tool with version control and approval workflows.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mt-8">
        <FeatureCard
          icon={Users}
          title="Team Collaboration"
          description="Organize queries by team with role-based access control"
        />
        <FeatureCard
          icon={GitBranch}
          title="Version Control"
          description="Track changes to queries with full revision history"
        />
        <FeatureCard
          icon={Shield}
          title="Approval Workflow"
          description="Peer review and configurable approval quotas"
        />
        <FeatureCard
          icon={Database}
          title="Self-Hosted"
          description="Run on your own infrastructure or use cloud services"
        />
      </div>

      <div className="pt-6 flex justify-end">
        <Button onClick={onNext} size="lg">
          Get Started
        </Button>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
      <div className="p-2 rounded-md bg-primary/10 text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
