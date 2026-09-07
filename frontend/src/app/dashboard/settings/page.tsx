"use client";

import KioskSettings from "@/components/settings/KioskSettings";
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
            You do not have permission to manage kiosk access.
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
          Manage kiosk access and security settings.
        </p>
      </div>

      <KioskSettings />
    </div>
  );
}
