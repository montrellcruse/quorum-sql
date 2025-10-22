import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TeamProvider } from "@/contexts/TeamContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Folder from "./pages/Folder";
import QueryEdit from "./pages/QueryEdit";
import QueryView from "./pages/QueryView";
import TeamAdmin from "./pages/TeamAdmin";
import CreateTeam from "./pages/CreateTeam";
import AcceptInvites from "./pages/AcceptInvites";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TeamProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/accept-invites" element={<AcceptInvites />} />
              <Route path="/create-team" element={<CreateTeam />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/folder/:id" element={<Folder />} />
              <Route path="/query/view/:id" element={<QueryView />} />
              <Route path="/query/edit/:id" element={<QueryEdit />} />
              <Route path="/team-admin" element={<TeamAdmin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TeamProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
