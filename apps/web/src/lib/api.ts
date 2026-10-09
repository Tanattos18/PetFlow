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
