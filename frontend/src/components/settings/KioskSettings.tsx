"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type Kiosk = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
};

type SessionWithAccessToken = { accessToken?: string };

type KioskResponse<T> = { success: boolean; data?: T; message?: string; error?: string };

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Något gick fel";
}

function formatTimestamp(value?: string): string {
  if (!value) return "Aldrig";
  return new Date(value).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

export default function KioskSettings() {
  const { data: session, status } = useSession();
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [name, setName] = useState("");
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingKioskId, setEditingKioskId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const accessToken = (session as unknown as SessionWithAccessToken | null)?.accessToken;

  const loadKiosks = async () => {
    if (!accessToken) return;
    const response = await api.get("/api/kiosks") as KioskResponse<Kiosk[]>;
    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || "Kunde inte hämta kiosker");
    }
    setKiosks(response.data);
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadKiosks().catch((nextError: unknown) => setError(messageFor(nextError)));
    }
  }, [status, accessToken]);

  const showActivationUrl = (accessKey: string) => {
    setActivationUrl(`${window.location.origin}/narvaro?k=${encodeURIComponent(accessKey)}`);
  };

  const createKiosk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post("/api/kiosks", { name: name.trim() }) as KioskResponse<{ kiosk: Kiosk; accessKey: string }>;
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || "Kunde inte skapa kiosken");
      }
      showActivationUrl(response.data.accessKey);
      setName("");
      await loadKiosks();
    } catch (nextError: unknown) {
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  };

  const rotateKiosk = async (kiosk: Kiosk) => {
    if (!accessToken || !window.confirm(`Byta nyckeln för ${kiosk.name}? Den gamla iPaden förlorar åtkomst.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.put(`/api/kiosks/${kiosk.id}/rotate`, {}) as KioskResponse<{ kiosk: Kiosk; accessKey: string }>;
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || "Kunde inte byta kiosknyckel");
      }
      showActivationUrl(response.data.accessKey);
      await loadKiosks();
    } catch (nextError: unknown) {
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  };

  const setKioskActive = async (kiosk: Kiosk, active: boolean) => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.put(`/api/kiosks/${kiosk.id}/status`, { active }) as KioskResponse<Kiosk>;
      if (!response.success) {
        throw new Error(response.error || response.message || "Kunde inte uppdatera kiosken");
      }
      await loadKiosks();
    } catch (nextError: unknown) {
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  };

  const copyActivationUrl = async () => {
    if (!activationUrl) return;
    try {
      await navigator.clipboard.writeText(activationUrl);
    } catch (nextError: unknown) {
      setError(`Kunde inte kopiera länken: ${messageFor(nextError)}`);
    }
  };

  const startEditingName = (kiosk: Kiosk) => {
    setEditingKioskId(kiosk.id);
    setEditingName(kiosk.name);
    setError(null);
  };

  const cancelEditingName = () => {
    setEditingKioskId(null);
    setEditingName("");
  };

  const saveKioskName = async (kiosk: Kiosk) => {
    if (!accessToken || !editingName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.put(`/api/kiosks/${kiosk.id}/name`, { name: editingName.trim() }) as KioskResponse<Kiosk>;
      if (!response.success) {
        throw new Error(response.error || response.message || "Kunde inte uppdatera kiosk-namnet");
      }
      await loadKiosks();
      setEditingKioskId(null);
      setEditingName("");
    } catch (nextError: unknown) {
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  };

  const deleteKiosk = async (kiosk: Kiosk) => {
    if (!accessToken || !window.confirm(`Är du säker på att du vill ta bort kiosken "${kiosk.name}"? Den kan inte återställas.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.delete(`/api/kiosks/${kiosk.id}`) as KioskResponse<void>;
      if (!response.success) {
        throw new Error(response.error || response.message || "Kunde inte ta bort kiosken");
      }
      await loadKiosks();
    } catch (nextError: unknown) {
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Närvarokiosker</CardTitle>
        <CardDescription>Skapa en unik aktiveringslänk för varje enhet. Länken visas bara när en kiosk skapas eller nyckeln byts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={createKiosk} className="flex flex-col gap-3 sm:flex-row">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Exempel: Entré-iPad" maxLength={100} aria-label="Kioskens namn" />
          <Button type="submit" disabled={busy || !name.trim()}>Skapa kiosk</Button>
        </form>

        {activationUrl && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="mb-2 font-semibold">Aktivera enheten nu</p>
            <p className="mb-3">Öppna eller skanna denna länk på enheten. Spara den inte i ett delat dokument.</p>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Input value={activationUrl} readOnly aria-label="Kioskens aktiveringslänk" className="mb-2 bg-white text-xs" />
                <Button type="button" variant="outline" onClick={copyActivationUrl}>Kopiera aktiveringslänk</Button>
              </div>
              <div className="flex justify-center sm:justify-start">
                <QRCodeCanvas value={activationUrl} size={150} level="H" includeMargin={true} />
              </div>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3">
          {kiosks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga kiosker har skapats ännu.</p>
          ) : kiosks.map((kiosk) => (
            <div key={kiosk.id} className="rounded-md border p-4">
              {editingKioskId === kiosk.id ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      maxLength={100}
                      aria-label="Nytt kiosknamn"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => saveKioskName(kiosk)}
                      disabled={busy || !editingName.trim()}
                    >
                      Spara
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEditingName}
                      disabled={busy}
                    >
                      Avbryt
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <p className="font-medium">{kiosk.name}</p>
                    <p className="text-sm text-muted-foreground">Senast använd: {formatTimestamp(kiosk.lastUsedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => rotateKiosk(kiosk)} disabled={busy}>Byt nyckel</Button>
                    <Button type="button" variant="outline" onClick={() => startEditingName(kiosk)} disabled={busy}>Byt namn</Button>
                    <Button type="button" variant={kiosk.active ? "destructive" : "default"} onClick={() => setKioskActive(kiosk, !kiosk.active)} disabled={busy}>
                      {kiosk.active ? "Inaktivera" : "Aktivera"}
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => deleteKiosk(kiosk)} disabled={busy}>Ta bort</Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
