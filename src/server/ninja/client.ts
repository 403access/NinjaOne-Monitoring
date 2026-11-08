export interface NinjaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  timeoutMs: number;
}

export class NinjaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "NinjaApiError";
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

const MAX_RETRIES = 3;

export class NinjaClient {
  private token?: string;
  private tokenExpiresAt = 0;
  private tokenPromise?: Promise<string>;

  constructor(readonly config: NinjaConfig) {}

  static fromEnv(): NinjaClient | undefined {
    const clientId = process.env.NINJA_CLIENT_ID?.trim();
    const clientSecret = process.env.NINJA_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return undefined;
    return new NinjaClient({
      baseUrl: (process.env.NINJA_BASE_URL ?? "https://app.ninjarmm.com").replace(/\/+$/, ""),
      clientId,
      clientSecret,
      scope: process.env.NINJA_SCOPE ?? "monitoring management",
      timeoutMs: Number(process.env.NINJA_TIMEOUT_MS ?? 15_000),
    });
  }

  get configured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  get host(): string {
    try {
      return new URL(this.config.baseUrl).host;
    } catch {
      return this.config.baseUrl;
    }
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = (async () => {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: this.config.scope,
      });
      const response = await fetch(`${this.config.baseUrl}/ws/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new NinjaApiError(`NinjaOne token request failed (${response.status})`, response.status, text.slice(0, 500));
      }
      let parsed: TokenResponse;
      try {
        parsed = JSON.parse(text) as TokenResponse;
      } catch {
        throw new NinjaApiError("NinjaOne token response was not JSON", response.status, text.slice(0, 500));
      }
      if (!parsed.access_token) throw new NinjaApiError("NinjaOne token response did not include access_token", 500);
      this.token = parsed.access_token;
      this.tokenExpiresAt = Date.now() + Math.max(30, parsed.expires_in - 60) * 1000;
      return this.token;
    })().finally(() => {
      this.tokenPromise = undefined;
    });

    return this.tokenPromise;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.config.baseUrl}${normalized.startsWith("/api/") ? normalized : `/api/v2${normalized}`}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      retry?: boolean;
    } = {},
  ): Promise<T> {
    const method = options.method ?? "GET";
    const retry = options.retry ?? true;
    let lastError: unknown;

    for (let attempt = 0; attempt < (retry ? MAX_RETRIES : 1); attempt += 1) {
      try {
        const token = await this.getToken();
        const response = await fetch(this.buildUrl(path, options.query), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (response.status === 204) return undefined as T;

        const text = await response.text();
        if (response.status === 401 && attempt === 0) {
          this.token = undefined;
          this.tokenExpiresAt = 0;
          continue;
        }
        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 0);
          const wait = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, wait));
            continue;
          }
        }
        if (!response.ok) {
          throw new NinjaApiError(`NinjaOne API ${method} ${path} failed (${response.status})`, response.status, text.slice(0, 1000));
        }
        if (!text) return undefined as T;
        return JSON.parse(text) as T;
      } catch (error) {
        lastError = error;
        if (error instanceof NinjaApiError && error.status < 500 && error.status !== 429) throw error;
        if (attempt < MAX_RETRIES - 1 && retry) {
          await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("NinjaOne request failed");
  }

  async getAlerts(): Promise<unknown[]> {
    return this.request<unknown[]>("/alerts");
  }

  async getDeviceAlerts(deviceId: number): Promise<unknown[]> {
    return this.request<unknown[]>(`/device/${deviceId}/alerts`);
  }

  async resetAlert(uid: string, data?: Record<string, unknown>): Promise<void> {
    if (data) {
      await this.request<void>(`/alert/${encodeURIComponent(uid)}/reset`, { method: "POST", body: data });
      return;
    }
    await this.request<void>(`/alert/${encodeURIComponent(uid)}`, { method: "DELETE" });
  }

  async getDevices(): Promise<unknown[]> {
    return this.paginate("/devices-detailed", 500);
  }

  async getPolicies(): Promise<unknown[]> {
    return this.request<unknown[]>("/policies");
  }

  async getOrganizations(): Promise<unknown[]> {
    return this.request<unknown[]>("/organizations");
  }

  async getLocations(): Promise<unknown[]> {
    return this.request<unknown[]>("/locations");
  }

  async getDeviceHealth(): Promise<unknown> {
    return this.request<unknown>("/queries/device-health", { query: { pageSize: 1000 } });
  }

  async getActivities(pageSize = 500): Promise<unknown[]> {
    const response = await this.request<unknown>("/activities", {
      query: { class: "ALL", pageSize, tz: "UTC" },
    });
    if (Array.isArray(response)) return response;
    if (response && typeof response === "object") {
      const record = response as Record<string, unknown>;
      if (Array.isArray(record.activities)) return record.activities;
      if (Array.isArray(record.results)) return record.results;
    }
    return [];
  }

  private async paginate(path: string, pageSize: number): Promise<unknown[]> {
    const all: unknown[] = [];
    let after: number | undefined;
    for (let page = 0; page < 40; page += 1) {
      const batch = await this.request<unknown[]>(path, { query: { pageSize, after } });
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      const last = batch[batch.length - 1] as Record<string, unknown> | undefined;
      const lastId = typeof last?.id === "number" ? last.id : undefined;
      if (!lastId || batch.length < pageSize) break;
      after = lastId;
    }
    return all;
  }
}
