"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type SetupStep = "qr" | "backup";

export function ReminderActions({ nextHref }: { nextHref: string }) {
  const router = useRouter();

  // 2FA setup flow
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("qr");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Dismiss flow
  const [neverLoading, setNeverLoading] = useState(false);

  async function openSetup() {
    setSetupLoading(true);
    setSetupError("");
    setVerifyCode("");
    setSetupStep("qr");
    const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
    setSetupLoading(false);
    if (!res.ok) { setSetupError("Failed to start setup. Try again."); return; }
    const data = await res.json();
    setQrCode(data.qrCode);
    setSecret(data.secret);
    setSetupOpen(true);
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError("");
    const res = await apiFetch("/api/auth/2fa/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, code: verifyCode }),
    });
    setSetupLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setSetupError(data.error ?? "Verification failed");
      return;
    }
    const data = await res.json();
    setBackupCodes(data.backupCodes);
    setSetupStep("backup");
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleNeverShow() {
    setNeverLoading(true);
    await apiFetch("/api/auth/2fa-reminder/dismiss", { method: "POST" });
    router.push(nextHref);
  }

  return (
    <>
      {setupError && !setupOpen && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{setupError}</p>
      )}

      <div className="space-y-3">
        <Button className="w-full" onClick={openSetup} loading={setupLoading}>
          Enable 2FA now
        </Button>
        <Button variant="outline" className="w-full" onClick={() => router.push(nextHref)}>
          Skip for now
        </Button>
        <button
          onClick={handleNeverShow}
          disabled={neverLoading}
          className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 py-1"
        >
          {neverLoading ? "Saving..." : "Don't show this again"}
        </button>
      </div>

      <Modal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title={setupStep === "qr" ? "Set up authenticator" : "Save your backup codes"}
        busy={setupLoading}
        footer={
          setupStep === "qr" ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setSetupOpen(false)}>Cancel</Button>
              <Button type="submit" form="2fa-reminder-form" loading={setupLoading}>Verify & Enable</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={downloadBackupCodes} className="gap-1.5">
                <Download size={14} />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={copyBackupCodes} className="gap-1.5">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy all"}
              </Button>
              <Button size="sm" onClick={() => router.push(nextHref)}>Done</Button>
            </div>
          )
        }
      >
        {setupStep === "qr" ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
            </p>

            {qrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="2FA QR Code" className="rounded-lg border border-slate-200" width={180} height={180} />
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-2">
              <p className="text-xs text-slate-500">Manual entry key</p>
              <p className="font-mono text-xs text-slate-800 break-all">{secret}</p>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(secret);
                    setSecretCopied(true);
                    setTimeout(() => setSecretCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {secretCopied ? <Check size={12} /> : <Copy size={12} />}
                  {secretCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <form id="2fa-reminder-form" onSubmit={confirmSetup} className="space-y-4">
              <Input
                label="Verification Code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="text-center tracking-widest font-mono text-lg"
                autoComplete="one-time-code"
                required
              />
              {setupError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{setupError}</p>
              )}
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Store these backup codes somewhere safe. Each code can only be used once if you lose access to your authenticator app.
            </p>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              {backupCodes.map((code) => (
                <span key={code} className="font-mono text-sm text-slate-800 text-center tracking-widest">
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
