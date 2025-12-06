import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Bot, Search, Globe, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentLogEntry, AgentStatusType } from "@shared/schema";

interface AgentActivityPanelProps {
  logs: AgentLogEntry[];
  status: AgentStatusType;
  isExpanded?: boolean;
}

const statusConfig: Record<AgentStatusType, { icon: typeof Loader2; color: string; label: string }> = {
  idle: { icon: Bot, color: "text-muted-foreground", label: "Idle" },
  searching: { icon: Search, color: "text-blue-500", label: "Searching" },
  analyzing: { icon: Globe, color: "text-amber-500", label: "Analyzing" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  error: { icon: AlertCircle, color: "text-destructive", label: "Error" },
};

const agentIcons: Record<string, typeof Bot> = {
  orchestrator: Bot,
  search: Search,
  analyzer: Globe,
};

function LogEntry({ log }: { log: AgentLogEntry }) {
  const config = statusConfig[log.status];
  const Icon = agentIcons[log.agentName.toLowerCase()] || Bot;
  const StatusIcon = config.icon;
  const isActive = log.status === "searching" || log.status === "analyzing";

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg transition-colors",
      isActive && "bg-muted/50"
    )}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        isActive ? "bg-primary/10" : "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{log.agentName}</span>
          <Badge
            variant={log.status === "completed" ? "outline" : "secondary"}
            className={cn("text-xs gap-1", config.color)}
          >
            {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
            {log.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
            {log.status === "error" && <AlertCircle className="h-3 w-3" />}
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{log.action}</p>
        {log.details && (
          <p className="text-xs text-muted-foreground/70 mt-1">{log.details}</p>
        )}
        <p className="text-xs text-muted-foreground/50 mt-1">
          {new Date(log.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

export function AgentActivityPanel({ logs, status, isExpanded: initialExpanded = true }: AgentActivityPanelProps) {
  const [isOpen, setIsOpen] = useState(initialExpanded);
  const [showDetails, setShowDetails] = useState(true);
  
  const globalConfig = statusConfig[status];
  const GlobalStatusIcon = globalConfig.icon;
  const isSearching = status === "searching" || status === "analyzing";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  isSearching ? "bg-primary/10" : "bg-muted"
                )}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <GlobalStatusIcon className={cn("h-4 w-4", globalConfig.color)} />
                  )}
                </div>
                Agent Activity
                <Badge variant="secondary" className="ml-2">
                  {logs.length} events
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(!showDetails);
                  }}
                  className="gap-1 text-xs"
                  data-testid="button-toggle-details"
                >
                  {showDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showDetails ? "Hide" : "Show"} Details
                </Button>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {showDetails ? (
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-4">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Bot className="h-10 w-10 mb-2 opacity-50" />
                      <p className="text-sm">No activity yet</p>
                    </div>
                  ) : (
                    [...logs].reverse().map((log) => (
                      <LogEntry key={log.id} log={log} />
                    ))
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {isSearching ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Agents are working...
                  </div>
                ) : (
                  <p>Activity details hidden</p>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
