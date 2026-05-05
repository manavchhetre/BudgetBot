const API_BASE = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";

export async function api(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Include credentials for session cookies
  options.credentials = "include";
  options.headers = headers;

  const response = await fetch(url, options);

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = `API Error: ${response.status}`;
    if (errorData.detail) {
      if (typeof errorData.detail === "string") {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      }
    }
    throw new Error(message);
  }

  return response.json();
}
