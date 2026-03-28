import type { GraphCollectionResponse } from "./types";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

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
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new GraphApiError(`Graph request failed for ${url}`, response.status, detail);
    }

    return response;
  }

  private resolveUrl(path: string) {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${GRAPH_ROOT}${path}`;
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
