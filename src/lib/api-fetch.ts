function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)cms_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function refreshCsrfToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/csrf", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return fetch(input, { ...init, credentials: "include" });
  }

  const withCsrf = (i: RequestInit | undefined): RequestInit => ({
    ...i,
    headers: { ...i?.headers, "X-CSRF-Token": getCsrfToken() },
    credentials: "include",
  });

  const response = await fetch(input, withCsrf(init));

  // On CSRF failure, refresh the token and retry once.
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => null);
    if (body?.error === "CSRF token invalid") {
      const refreshed = await refreshCsrfToken();
      if (refreshed) {
        return fetch(input, withCsrf(init));
      }
    }
  }

  return response;
}
