import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Clock, Save, Plus, Trash2 } from "lucide-react";
import type { DiscoveryScope } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  discoveryScheduleQueryOptions,
  discoveryUpdateScheduleMutation,
} from "~/lib/discoveryReactQuery";

const SCOPE_OPTIONS: DiscoveryScope[] = ["full", "product", "techdebt", "guided-intelligence"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DiscoverySchedule() {
  const queryClient = useQueryClient();
  const { data: schedule, isLoading } = useQuery(discoveryScheduleQueryOptions());
  const updateSchedule = useMutation(discoveryUpdateScheduleMutation(queryClient));

  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(22);
  const [minute, setMinute] = useState(0);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scopeRotation, setScopeRotation] = useState<DiscoveryScope[]>(["full"]);
  const [fullAuditEveryN, setFullAuditEveryN] = useState(7);
  const [focus, setFocus] = useState("");

  // Sync form from server data
  useEffect(() => {
    if (!schedule) return;
    setEnabled(schedule.enabled);
    if (schedule.hour !== undefined) setHour(schedule.hour);
    if (schedule.minute !== undefined) setMinute(schedule.minute);
    if (schedule.daysOfWeek) setDaysOfWeek([...schedule.daysOfWeek]);
    setScopeRotation(schedule.scopeRotation as DiscoveryScope[]);
    setFullAuditEveryN(schedule.fullAuditEveryN);
    setFocus(schedule.focus ?? "");
  }, [schedule]);

  const handleSave = () => {
    updateSchedule.mutate({
      enabled,
      hour,
      minute,
      daysOfWeek,
      cronExpression: `${minute} ${hour} * * ${daysOfWeek.join(",")}`,
      scopeRotation,
      fullAuditEveryN,
      focus: focus.trim() || undefined,
    });
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const addScope = (scope: DiscoveryScope) => {
    if (!scopeRotation.includes(scope)) {
      setScopeRotation([...scopeRotation, scope]);
    }
  };

  const removeScope = (index: number) => {
    if (scopeRotation.length > 1) {
      setScopeRotation(scopeRotation.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Schedule Configuration</h1>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {/* Enable/Disable */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">Enable Scheduled Runs</p>
              <p className="text-xs text-muted-foreground">
                Automatically run discovery on a schedule
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </CardContent>
        </Card>

        {/* Time Picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run Time</CardTitle>
            <CardDescription>When to run scheduled discovery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="w-20"
                />
                <span>:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))}
                  className="w-20"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((name, i) => (
                <Button
                  key={i}
                  variant={daysOfWeek.includes(i) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(i)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scope Rotation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope Rotation</CardTitle>
            <CardDescription>
              Cycle through these scopes on each scheduled run
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {scopeRotation.map((scope, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {i + 1}. {scope}
                  {scopeRotation.length > 1 && (
                    <button
                      onClick={() => removeScope(i)}
                      className="ml-1 rounded-full hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              {SCOPE_OPTIONS.filter((s) => !scopeRotation.includes(s)).map((scope) => (
                <Button
                  key={scope}
                  variant="outline"
                  size="sm"
                  onClick={() => addScope(scope)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {scope}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Full audit every</span>
              <Input
                type="number"
                min={1}
                max={30}
                value={fullAuditEveryN}
                onChange={(e) => setFullAuditEveryN(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm">rotations</span>
            </div>
          </CardContent>
        </Card>

        {/* Focus */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Focus (Optional)</CardTitle>
            <CardDescription>
              One-shot directive for the next scheduled run (consumed once)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="e.g., look at caching strategy"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Next Run Preview */}
        {schedule?.nextRunAt && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                Next scheduled run:{" "}
                <span className="font-medium text-foreground">
                  {new Date(schedule.nextRunAt).toLocaleString()}
                </span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateSchedule.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/discovery/schedule")({
  component: DiscoverySchedule,
});
