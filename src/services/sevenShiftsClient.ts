interface ClientOptions {
  baseUrl: string;
  accessToken: string;
  fetchFn?: typeof fetch;
}

export interface SevenShiftsCompany {
  id: string;
  name: string;
}

export type SevenShiftsUser = Record<string, unknown>;

export class SevenShiftsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SevenShiftsApiError";
    this.status = status;
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function extractData(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === "object" && payload !== null) {
    return asArray((payload as Record<string, unknown>).data);
  }
  return [];
}

function parseNextFromLink(link: string): { cursor?: string; page?: number } {
  try {
    const url = new URL(link);
    const cursor = url.searchParams.get("cursor") || undefined;
    const pageValue = url.searchParams.get("page");

    if (cursor) {
      return { cursor };
    }

    if (pageValue) {
      const page = Number.parseInt(pageValue, 10);
      if (Number.isFinite(page)) {
        return { page };
      }
    }
  } catch {
    // ignore malformed links and fall back to other pagination hints
  }

  return {};
}

function extractNext(payload: unknown): { cursor?: string; page?: number } {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }

  const body = payload as Record<string, unknown>;
  const meta = (body.meta as Record<string, unknown> | undefined) || {};

  const cursorCandidate =
    (meta.cursor as Record<string, unknown> | undefined)?.next ||
    meta.next_cursor ||
    (meta.pagination as Record<string, unknown> | undefined)?.next_cursor ||
    body.next_cursor;

  if (typeof cursorCandidate === "string" && cursorCandidate.length > 0) {
    return { cursor: cursorCandidate };
  }

  const linkCandidate =
    (body.links as Record<string, unknown> | undefined)?.next ||
    (meta.links as Record<string, unknown> | undefined)?.next;

  if (typeof linkCandidate === "string" && linkCandidate.length > 0) {
    return parseNextFromLink(linkCandidate);
  }

  return {};
}

export class SevenShiftsClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.accessToken = options.accessToken;
    this.fetchFn = options.fetchFn || fetch;
  }

  private async request(pathname: string, params: URLSearchParams): Promise<unknown> {
    const url = `${this.baseUrl}${pathname}?${params.toString()}`;

    const response = await this.fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`
      }
    });

    const body = await response.text();
    let parsed: unknown = null;

    if (body) {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = body;
      }
    }

    if (!response.ok) {
      const message = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      throw new SevenShiftsApiError(
        `7shifts API error (${response.status}): ${message.slice(0, 400)}`,
        response.status
      );
    }

    return parsed;
  }

  private async listAll(pathname: string): Promise<unknown[]> {
    const limit = 200;
    const maxRequests = 200;
    const records: unknown[] = [];
    let cursor: string | undefined;
    let page = 1;
    let usePageMode = false;
    const seenCursors = new Set<string>();
    let requestCount = 0;

    while (true) {
      requestCount += 1;
      if (requestCount > maxRequests) {
        throw new SevenShiftsApiError(
          `Exceeded pagination safety limit (${maxRequests}) for ${pathname}.`,
          500
        );
      }

      const params = new URLSearchParams({ limit: String(limit) });

      if (cursor) {
        params.set("cursor", cursor);
      } else if (usePageMode) {
        params.set("page", String(page));
      }

      const payload = await this.request(pathname, params);
      const chunk = extractData(payload);
      records.push(...chunk);

      const next = extractNext(payload);
      if (next.cursor) {
        if (seenCursors.has(next.cursor)) {
          break;
        }
        seenCursors.add(next.cursor);
        cursor = next.cursor;
        usePageMode = false;
        continue;
      }

      if (Number.isFinite(next.page) && next.page) {
        page = next.page;
        cursor = undefined;
        usePageMode = true;
        continue;
      }

      if (!cursor && chunk.length === limit) {
        page += 1;
        usePageMode = true;
        continue;
      }

      break;
    }

    return records;
  }

  async listCompanies(): Promise<SevenShiftsCompany[]> {
    const rows = await this.listAll("/companies");

    return rows
      .map((row) => {
        const company = row as Record<string, unknown>;
        const id = company.id;
        const name = company.name;

        if ((typeof id !== "string" && typeof id !== "number") || typeof name !== "string") {
          return null;
        }

        return {
          id: String(id),
          name: name.trim() || `Company ${id}`
        };
      })
      .filter((company): company is SevenShiftsCompany => company !== null);
  }

  async listUsers(companyId: string): Promise<SevenShiftsUser[]> {
    const rows = await this.listAll(`/company/${encodeURIComponent(companyId)}/users`);

    return rows.filter((row): row is SevenShiftsUser => {
      if (typeof row !== "object" || row === null) {
        return false;
      }
      const id = (row as Record<string, unknown>).id;
      return typeof id === "string" || typeof id === "number";
    });
  }
}
