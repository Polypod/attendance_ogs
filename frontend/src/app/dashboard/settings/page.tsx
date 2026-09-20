"use client";

import KioskSettings from "@/components/settings/KioskSettings";
import MemberSyncSettings from "@/components/settings/MemberSyncSettings";
import StudentDataSettings from "@/components/settings/StudentDataSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <div className="mx-auto w-full max-w-6xl">Loading settings...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>This section is limited to administrators.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You do not have permission to access administrative settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage administrative configuration, member register sync, student data exchange, and kiosk access settings.
        </p>
      </div>

      <MemberSyncSettings />
      <StudentDataSettings />
      <KioskSettings />
    </div>
  );
}
