import { Outlet, createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { Telescope, History, Activity, Clock } from "lucide-react";
import { Sidebar, SidebarProvider, SidebarInset } from "~/components/ui/sidebar";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "~/components/ui/sidebar";
import { useDiscoveryStore } from "~/store/discoveryStore";

const NAV_ITEMS = [
  { to: "/discovery", label: "Dashboard", icon: Telescope, exact: true },
  { to: "/discovery/runs", label: "Run History", icon: History, exact: false },
  { to: "/discovery/agents", label: "Agent Health", icon: Activity, exact: false },
  { to: "/discovery/schedule", label: "Schedule", icon: Clock, exact: false },
] as const;

function DiscoverySidebar() {
  const location = useLocation();
  const activeRunId = useDiscoveryStore((s) => s.activeRunId);

  return (
    <>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <Telescope className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Discovery</span>
          {activeRunId && (
            <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === "/discovery" || location.pathname === "/discovery/"
              : location.pathname.startsWith(item.to);

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton isActive={isActive}>
                  <Link to={item.to as any} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}

function DiscoveryLayout() {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        side="left"
        collapsible="offcanvas"
        className="border-r border-border bg-card text-foreground"
      >
        <DiscoverySidebar />
      </Sidebar>
      <SidebarInset className="flex flex-col overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Route = createFileRoute("/discovery")({
  component: DiscoveryLayout,
});
