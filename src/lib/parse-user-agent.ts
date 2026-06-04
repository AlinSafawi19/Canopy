export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) {
    return { browser: "Unknown", os: "Unknown", device: "Unknown" };
  }

  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  // Parse browser
  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Edge")) browser = "Edge";
  else if (userAgent.includes("Opera")) browser = "Opera";

  // Parse OS
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
  else if (userAgent.includes("Android")) os = "Android";

  // Parse device type
  if (
    userAgent.includes("Mobile") ||
    userAgent.includes("iPhone") ||
    userAgent.includes("Android") ||
    userAgent.includes("Tablet")
  ) {
    device = userAgent.includes("Tablet") || userAgent.includes("iPad") ? "Tablet" : "Mobile";
  }

  return { browser, os, device };
}

export function formatDeviceInfo(userAgent: string | null | undefined): string {
  const { browser, os } = parseUserAgent(userAgent);
  if (browser === "Unknown" && os === "Unknown") return "Unknown Device";
  return `${browser} on ${os}`;
}
