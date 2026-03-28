import type { GraphCollectionResponse } from "./types";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export class GraphApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "GraphApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class GraphClient {
  #getAccessToken: (group: "core" | "reports" | "advancedAudit") => Promise<string>;

  constructor(getAccessToken: (group: "core" | "reports" | "advancedAudit") => Promise<string>) {
    this.#getAccessToken = getAccessToken;
  }

  async getJson<T>(
    path: string,
    group: "core" | "reports" | "advancedAudit" = "core",
    init?: RequestInit
  ): Promise<T> {
    const response = await this.request(path, group, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {})
      }
    });

    return (await response.json()) as T;
  }

  async getText(
    path: string,
    group: "core" | "reports" | "advancedAudit" = "reports",
    init?: RequestInit
  ) {
    const response = await this.request(path, group, {
      ...init,
      headers: {
        Accept: "text/plain, text/csv, application/json",
        ...(init?.headers ?? {})
      }
    });

    return response.text();
  }

  async getAllPages<T>(
    path: string,
    group: "core" | "reports" | "advancedAudit" = "core",
    init?: RequestInit
  ) {
    const results: T[] = [];
    let nextUrl: string | undefined = this.resolveUrl(path);

    while (nextUrl) {
      const page: GraphCollectionResponse<T> = await this.getJson<GraphCollectionResponse<T>>(
        nextUrl,
        group,
        init
      );
      results.push(...page.value);
      nextUrl = page["@odata.nextLink"];
    }

    return results;
  }

  private async request(
    path: string,
    group: "core" | "reports" | "advancedAudit",
    init?: RequestInit
  ) {
    const token = await this.#getAccessToken(group);
    const url = this.resolveUrl(path);

    let lastError: GraphApiError | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0 && lastError) {
        const delay = getRetryDelay(lastError, attempt);
        await sleep(delay);
      }

      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {})
        }
      });

      if (response.ok) {
        return response;
      }

      const detail = await safeReadText(response);
      lastError = new GraphApiError(`Graph request failed for ${url}`, response.status, detail);

      if (!isRetryable(response.status)) {
        throw lastError;
      }
    }

    throw lastError;
  }

  private resolveUrl(path: string) {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${GRAPH_ROOT}${path}`;
  }
}

function isRetryable(status: number) {
  return status === 429 || status === 503 || status === 504;
}

function getRetryDelay(error: GraphApiError, attempt: number) {
  const retryAfter = parseRetryAfterHeader(error.detail);
  if (retryAfter > 0) {
    return retryAfter * 1000;
  }

  return RETRY_DELAY_MS * Math.pow(2, attempt - 1);
}

function parseRetryAfterHeader(detail?: string) {
  if (!detail) return 0;

  const match = /Retry-After:\s*(\d+)/i.exec(detail);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
