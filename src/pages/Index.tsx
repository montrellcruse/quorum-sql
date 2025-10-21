import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">SQL Query Manager</h1>
        <p className="text-xl text-muted-foreground max-w-md">
          Organize, store, and track your SQL queries with version history
        </p>
        <Button onClick={() => navigate("/auth")} size="lg">
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Index;
