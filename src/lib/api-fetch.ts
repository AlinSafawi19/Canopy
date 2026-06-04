function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)cms_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    init = {
      ...init,
      headers: { ...init?.headers, "X-CSRF-Token": getCsrfToken() },
    };
  }
  return fetch(input, {
    ...init,
    credentials: "include", // Send cookies with request
  });
}
