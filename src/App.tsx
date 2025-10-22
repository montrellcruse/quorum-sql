import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { lazy, Suspense } from "react";

// Lazy load all page components for better performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Folder = lazy(() => import("./pages/Folder"));
const QueryEdit = lazy(() => import("./pages/QueryEdit"));
const QueryView = lazy(() => import("./pages/QueryView"));
const TeamAdmin = lazy(() => import("./pages/TeamAdmin"));
const CreateTeam = lazy(() => import("./pages/CreateTeam"));
const AcceptInvites = lazy(() => import("./pages/AcceptInvites"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <TeamProvider>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
              </div>}>
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
              </Suspense>
            </TeamProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
