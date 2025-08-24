/*
  Minimal Merkl API client (Opportunities endpoints)
*/

export type OpportunitiesQuery = {
  page?: number;
  items?: number;
  name?: string;
  search?: string;
  campaignId?: string;
  creatorSlug?: string;
  chainId?: string; // comma-separated numbers per API
  action?: string; // comma-separated actions
  tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[];
  point?: boolean;
  type?: string; // comma-separated types
  creatorAddress?: string;
  tags?: string; // comma-separated tags
  test?: boolean;
  minimumTvl?: number;
  maximumTvl?: number;
  minimumApr?: number;
  maximumApr?: number;
  status?: string; // comma-separated LIVE,PAST,SOON
  identifier?: string;
  campaigns?: boolean;
  tokens?: string; // comma-separated symbols
  rewardTokenSymbol?: string;
  sort?: "apr" | "tvl" | "rewards" | "lastCampaignCreatedAt";
  order?: "asc" | "desc";
  distributionTypes?: ("FIX_REWARD" | "MAX_REWARD" | "DUTCH_AUCTION")[];
  mainProtocolId?: string; // comma-separated ids
  programSlugs?: string; // comma-separated slugs
  chainName?: string; // comma-separated names
  excludeSubCampaigns?: boolean;
};

import nodeFetch from "node-fetch"

type NodeFetch = typeof nodeFetch

export interface MerklClientOptions {
  baseUrl?: string; // default https://api.merkl.xyz
  apiKey?: string; // optional bearer token, if provided
  fetchFn?: NodeFetch; // override for testing
}

export class MerklClient {
  private baseUrl: string;
  private apiKey?: string;
  private fetchFn: NodeFetch;

  constructor(opts: MerklClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.MERKL_BASE_URL ?? "https://api.merkl.xyz").replace(/\/$/, "");
    this.apiKey = opts.apiKey ?? process.env.MERKL_API_KEY;
    this.fetchFn = opts.fetchFn ?? nodeFetch;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) h["authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  private toQuery(params: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) {
        // API expects comma-separated for arrays
        if (v.length) qs.set(k, v.join(","));
      } else {
        qs.set(k, String(v));
      }
    }
    const s = qs.toString();
    return s ? `?${s}` : "";
  }

  async listOpportunities(q: OpportunitiesQuery = {}) {
    const url = `${this.baseUrl}/v4/opportunities/${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl list opportunities failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getOpportunity(
    id: string,
    q: {
      test?: boolean;
      point?: boolean;
      tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[];
      campaigns?: boolean;
      excludeSubCampaigns?: boolean;
    } = {}
  ) {
    if (!id) throw new Error("id is required");
    const url = `${this.baseUrl}/v4/opportunities/${encodeURIComponent(id)}${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Merkl get opportunity failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getOpportunityCampaigns(
    id: string,
    q: {
      test?: boolean;
      point?: boolean;
      tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[];
      campaigns?: boolean;
      excludeSubCampaigns?: boolean;
    } = {}
  ) {
    if (!id) throw new Error("id is required");
    const url = `${this.baseUrl}/v4/opportunities/${encodeURIComponent(id)}/campaigns${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Merkl get opportunity campaigns failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async countOpportunities(q: Omit<OpportunitiesQuery, "page" | "items"> = {}) {
    const url = `${this.baseUrl}/v4/opportunities/count${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl count opportunities failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async binsApr(q: Omit<OpportunitiesQuery, "sort" | "order"> = {}) {
    const url = `${this.baseUrl}/v4/opportunities/bins/apr${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl bins apr failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async binsTvl(q: Omit<OpportunitiesQuery, "sort" | "order"> = {}) {
    const url = `${this.baseUrl}/v4/opportunities/bins/tvl${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl bins tvl failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async aggregate(field: string, q: OpportunitiesQuery = {}) {
    const url = `${this.baseUrl}/v4/opportunities/aggregate/${encodeURIComponent(field)}${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl aggregate failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async aggregateMax(field: string, q: OpportunitiesQuery = {}) {
    const url = `${this.baseUrl}/v4/opportunities/aggregate/max/${encodeURIComponent(field)}${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl aggregate max failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async aggregateMin(field: string, q: OpportunitiesQuery = {}) {
    const url = `${this.baseUrl}/v4/opportunities/aggregate/min/${encodeURIComponent(field)}${this.toQuery(q as any)}`;
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Merkl aggregate min failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
}
