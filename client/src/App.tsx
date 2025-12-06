import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <Link href="/">
                  <a className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">SS</span>
                    </div>
                    <span className="font-semibold text-lg hidden sm:inline">SourceScout</span>
                  </a>
                </Link>
                <nav className="flex items-center gap-1">
                  <Link href="/">
                    <Button 
                      variant={location === "/" ? "secondary" : "ghost"} 
                      size="sm"
                      data-testid="nav-sourcing"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Sourcing
                    </Button>
                  </Link>
                </nav>
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main>
            <Router />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
