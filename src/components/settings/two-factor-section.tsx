"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type SetupStep = "qr" | "backup";

export function TwoFactorSection({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const router = useRouter();

  // Enable flow
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

  // Disable flow
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");

  // Backup codes view
  const [codesOpen, setCodesOpen] = useState(false);
  const [codesError, setCodesError] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  async function openSetup() {
    setSetupLoading(true);
    setSetupError("");
    setVerifyCode("");
    setSetupStep("qr");
    const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
    setSetupLoading(false);
    if (!res.ok) { setSetupError("Failed to start setup"); return; }
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

  function closeSetup() {
    setSetupOpen(false);
    if (setupStep === "backup") router.refresh();
  }

  async function handleDisable() {
    setDisableLoading(true);
    setDisableError("");
    const res = await apiFetch("/api/auth/2fa", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: disableCode }),
    });
    setDisableLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setDisableError(data.error ?? "Failed to disable 2FA");
      return;
    }
    setDisableOpen(false);
    setDisableCode("");
    router.refresh();
  }

  return (
    <div className="pt-6 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${twoFactorEnabled ? "bg-emerald-50" : "bg-slate-100"}`}>
            {twoFactorEnabled
              ? <ShieldCheck size={16} className="text-emerald-600" />
              : <ShieldOff size={16} className="text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-900">Two-Factor Authentication</p>
              {twoFactorEnabled
                ? <Badge variant="success">Enabled</Badge>
                : <Badge variant="default">Disabled</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {twoFactorEnabled
                ? "Your account is protected with an authenticator app. A one-time code is required on every login."
                : "Require a one-time code from your phone on every login, in addition to your password."}
            </p>
            {!twoFactorEnabled && (
              <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Even if someone steals or guesses your password, they still can&apos;t log in without the time-sensitive code from your device. This stops the most common account takeover attacks.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    Protects against phishing, credential leaks, and brute force
                  </li>
                  <li className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    Works with Google Authenticator, Authy, 1Password, and more
                  </li>
                  <li className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    Comes with 10 one-time backup codes if you lose your phone
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="sm:flex-shrink-0 flex gap-2">
          {twoFactorEnabled ? (
            <>
              <Button variant="outline" size="md" onClick={() => { setCodesOpen(true); setCodesError(""); setShowBackupCodes(false); }}>
                Backup codes
              </Button>
              <Button variant="outline" size="md" onClick={() => { setDisableCode(""); setDisableError(""); setDisableOpen(true); }}>
                Disable
              </Button>
            </>
          ) : (
            <Button size="md" onClick={openSetup} loading={setupLoading}>
              Enable
            </Button>
          )}
        </div>
      </div>

      {/* Setup Modal */}
      <Modal
        open={setupOpen}
        onClose={closeSetup}
        title={setupStep === "qr" ? "Set up authenticator" : "Save your backup codes"}
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

            <form onSubmit={confirmSetup} className="space-y-4" id="2fa-confirm">
              <Input
                type="text"
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
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={closeSetup}>Cancel</Button>
                <Button type="submit" loading={setupLoading}>Verify & Enable</Button>
              </div>
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

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button variant="outline" size="md" onClick={downloadBackupCodes} className="gap-1.5">
                <Download size={14} />
                Download
              </Button>
              <Button variant="outline" size="md" onClick={copyBackupCodes} className="gap-1.5">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy all"}
              </Button>
              <Button size="md" onClick={closeSetup}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Disable confirm */}
      <ConfirmModal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onConfirm={handleDisable}
        title="Disable Two-Factor Authentication"
        message=""
        confirmLabel="Disable"
        variant="danger"
        loading={disableLoading}
      >
        <div className="space-y-3 mb-2">
          <p className="text-sm text-slate-500">Enter the code from your authenticator app (or a backup code) to confirm.</p>
          <Input
            type="text"
            label="Authenticator or backup code"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="000000"
            autoFocus
          />
          {disableError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{disableError}</p>
          )}
        </div>
      </ConfirmModal>

      {/* Backup codes modal */}
      <Modal
        open={codesOpen}
        onClose={() => setCodesOpen(false)}
        title="Your Backup Codes"
      >
        <div className="space-y-4">
          {!showBackupCodes ? (
            <>
              <p className="text-sm text-slate-500">
                Use these codes if you lose access to your authenticator app. Each code can only be used once.
              </p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                <p className="text-sm text-indigo-700">
                  <strong>Keep these codes safe.</strong> Store them somewhere secure like a password manager.
                </p>
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowBackupCodes(true)}
                  className="flex-1"
                >
                  View Codes
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowBackupCodes(true)}
                  className="flex-1"
                >
                  Regenerate
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Your current backup codes:
              </p>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                {backupCodes.map((code) => (
                  <span key={code} className="font-mono text-sm text-slate-800 text-center tracking-widest">
                    {code}
                  </span>
                ))}
              </div>
              {codesError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{codesError}</p>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <Button variant="outline" size="md" onClick={downloadBackupCodes} className="gap-1.5">
                  <Download size={14} />
                  Download
                </Button>
                <Button variant="outline" size="md" onClick={copyBackupCodes} className="gap-1.5">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy all"}
                </Button>
                <Button size="md" onClick={() => setCodesOpen(false)}>Done</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
