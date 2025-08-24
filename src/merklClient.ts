/*
  Minimal Merkl API client (Opportunities endpoints)
*/

export type OpportunitiesQuery = {
	page?: number
	items?: number
	name?: string
	search?: string
	campaignId?: string
	creatorSlug?: string
	chainId?: string // comma-separated numbers per API
	action?: string // comma-separated actions
	tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[]
	point?: boolean
	type?: string // comma-separated types
	creatorAddress?: string
	tags?: string // comma-separated tags
	test?: boolean
	minimumTvl?: number
	maximumTvl?: number
	minimumApr?: number
	maximumApr?: number
	status?: string // comma-separated LIVE,PAST,SOON
	identifier?: string
	campaigns?: boolean
	tokens?: string // comma-separated symbols
	rewardTokenSymbol?: string
	sort?: "apr" | "tvl" | "rewards" | "lastCampaignCreatedAt"
	order?: "asc" | "desc"
	distributionTypes?: ("FIX_REWARD" | "MAX_REWARD" | "DUTCH_AUCTION")[]
	mainProtocolId?: string // comma-separated ids
	programSlugs?: string // comma-separated slugs
	chainName?: string // comma-separated names
	excludeSubCampaigns?: boolean
}

export type CampaignsQuery = {
	page?: number
	items?: number
	name?: string
	search?: string
	campaignId?: string
	creatorSlug?: string
	chainId?: string // comma-separated numbers per API
	action?: string // comma-separated actions
	tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[]
	point?: boolean
	type?: string // comma-separated types
	creatorAddress?: string
	tags?: string // comma-separated tags
	test?: boolean
	minimumTvl?: number
	maximumTvl?: number
	minimumApr?: number
	maximumApr?: number
	status?: string // comma-separated LIVE,PAST,SOON
	identifier?: string
	tokens?: string // comma-separated symbols
	rewardTokenSymbol?: string
	sort?: "apr" | "tvl" | "rewards" | "lastCampaignCreatedAt" | "createdAt"
	order?: "asc" | "desc"
	distributionTypes?: ("FIX_REWARD" | "MAX_REWARD" | "DUTCH_AUCTION")[]
	mainProtocolId?: string // comma-separated ids
	programSlugs?: string // comma-separated slugs
	chainName?: string // comma-separated names
	excludeSubCampaigns?: boolean
	opportunityId?: string
	rewardTokenId?: string
	computeChainId?: string
	distributionChainId?: string
	startTimestamp?: number
	endTimestamp?: number
}

import nodeFetch from "node-fetch"

type NodeFetch = typeof nodeFetch

export interface MerklClientOptions {
	baseUrl?: string // default https://api.merkl.xyz
	apiKey?: string // optional bearer token, if provided
	fetchFn?: NodeFetch // override for testing
	timeoutMs?: number // request timeout in ms (default: 20000)
}

export class MerklClient {
	private baseUrl: string
	private apiKey?: string
	private fetchFn: NodeFetch
	private timeoutMs: number

	constructor(opts: MerklClientOptions = {}) {
		this.baseUrl = (opts.baseUrl ?? process.env.MERKL_BASE_URL ?? "https://api.merkl.xyz").replace(/\/$/, "")
		this.apiKey = opts.apiKey ?? process.env.MERKL_API_KEY
		this.fetchFn = opts.fetchFn ?? nodeFetch
		const envTimeout = process.env.MERKL_TIMEOUT_MS ? Number(process.env.MERKL_TIMEOUT_MS) : undefined
		this.timeoutMs = Number.isFinite(opts.timeoutMs as number)
			? (opts.timeoutMs as number)
			: Number.isFinite(envTimeout as number)
				? (envTimeout as number)
				: 20000
	}

	private headers(): Record<string, string> {
		const h: Record<string, string> = { "content-type": "application/json" }
		if (this.apiKey) h["authorization"] = `Bearer ${this.apiKey}`
		return h
	}

	private async fetchJson<T = any>(url: string, opts: { allow404?: boolean } = {}): Promise<T> {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), this.timeoutMs)
		try {
			const res = await this.fetchFn(url, { headers: this.headers(), signal: controller.signal } as any)
			if (opts.allow404 && (res as any).status === 404) return null as T
			if (!(res as any).ok) {
				throw new Error(`Merkl request failed: ${(res as any).status} ${(res as any).statusText}`)
			}
			return (res as any).json()
		} catch (err: any) {
			if (err?.name === "AbortError") {
				throw new Error(`Merkl request timed out after ${this.timeoutMs}ms`)
			}
			throw err
		} finally {
			clearTimeout(timer)
		}
	}

	private toQuery(params: Record<string, unknown>): string {
		const qs = new URLSearchParams()
		for (const [k, v] of Object.entries(params)) {
			if (v === undefined || v === null || v === "") continue
			if (Array.isArray(v)) {
				// API expects comma-separated for arrays
				if (v.length) qs.set(k, v.join(","))
			} else {
				qs.set(k, String(v))
			}
		}
		const s = qs.toString()
		return s ? `?${s}` : ""
	}

	async listOpportunities(q: OpportunitiesQuery = {}) {
		const url = `${this.baseUrl}/v4/opportunities/${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async getOpportunity(
		id: string,
		q: {
			test?: boolean
			point?: boolean
			tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[]
			campaigns?: boolean
			excludeSubCampaigns?: boolean
		} = {}
	) {
		if (!id) throw new Error("id is required")
		const url = `${this.baseUrl}/v4/opportunities/${encodeURIComponent(id)}${this.toQuery(q as any)}`
		return this.fetchJson(url, { allow404: true })
	}

	async getOpportunityCampaigns(
		id: string,
		q: {
			test?: boolean
			point?: boolean
			tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[]
			campaigns?: boolean
			excludeSubCampaigns?: boolean
		} = {}
	) {
		if (!id) throw new Error("id is required")
		const url = `${this.baseUrl}/v4/opportunities/${encodeURIComponent(id)}/campaigns${this.toQuery(q as any)}`
		return this.fetchJson(url, { allow404: true })
	}

	async countOpportunities(q: Omit<OpportunitiesQuery, "page" | "items"> = {}): Promise<number> {
		const url = `${this.baseUrl}/v4/opportunities/count${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async binsApr(q: Omit<OpportunitiesQuery, "sort" | "order"> = {}) {
		const url = `${this.baseUrl}/v4/opportunities/bins/apr${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async binsTvl(q: Omit<OpportunitiesQuery, "sort" | "order"> = {}) {
		const url = `${this.baseUrl}/v4/opportunities/bins/tvl${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async aggregate(field: string, q: OpportunitiesQuery = {}) {
		const url = `${this.baseUrl}/v4/opportunities/aggregate/${encodeURIComponent(field)}${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async aggregateMax(field: string, q: OpportunitiesQuery = {}) {
		const url = `${this.baseUrl}/v4/opportunities/aggregate/max/${encodeURIComponent(field)}${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async aggregateMin(field: string, q: OpportunitiesQuery = {}) {
		const url = `${this.baseUrl}/v4/opportunities/aggregate/min/${encodeURIComponent(field)}${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	// Campaign endpoints
	async listCampaigns(q: CampaignsQuery = {}) {
		const url = `${this.baseUrl}/v4/campaigns${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}

	async getCampaign(
		id: string,
		q: {
			test?: boolean
			point?: boolean
			tokenTypes?: ("TOKEN" | "PRETGE" | "POINT")[]
			excludeSubCampaigns?: boolean
		} = {}
	) {
		if (!id) throw new Error("id is required")
		const url = `${this.baseUrl}/v4/campaigns/${encodeURIComponent(id)}${this.toQuery(q as any)}`
		return this.fetchJson(url, { allow404: true })
	}

	async countCampaigns(q: Omit<CampaignsQuery, "page" | "items"> = {}): Promise<number> {
		const url = `${this.baseUrl}/v4/campaigns/count${this.toQuery(q as any)}`
		return this.fetchJson(url)
	}
}
