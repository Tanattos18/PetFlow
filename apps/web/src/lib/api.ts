export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends RequestInit {
  redirectOnUnauthorized?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { redirectOnUnauthorized = true, headers, ...rest } = options;

  const response = await fetch(path, {
    credentials: "same-origin",
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
  });

  if (response.status === 401 && redirectOnUnauthorized && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new ApiError("Sessão expirada", 401);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body?.message === "string" ? body.message : "Erro ao processar a solicitação";
    throw new ApiError(message, response.status, body?.issues);
  }

  return body as T;
}

export async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(path, { credentials: "same-origin" });

  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new ApiError("Sessão expirada", 401);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.message === "string" ? body.message : "Erro ao exportar CSV";
    throw new ApiError(message, response.status, body?.issues);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
