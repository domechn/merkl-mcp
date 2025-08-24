import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { MerklClient, OpportunitiesQuery } from "./merklClient.js"
import _ from 'lodash'

// Fail fast on unsupported Node versions to avoid silent protocol issues
const [nodeMajor] = process.versions.node.split(".").map((s) => Number(s))
if (!Number.isFinite(nodeMajor) || nodeMajor < 18) {
	// eslint-disable-next-line no-console
	console.error(
		`[merkl-mcp] ERROR: Node.js ${process.versions.node} is not supported. Please use Node >= 18.\n` +
		`You can point Claude to a newer Node by setting the MCP config command to the absolute path of Node 18+.`
	)
	process.exit(1)
}

const client = new MerklClient({})
const server = new McpServer({ name: "merkl-mcp", version: "0.1.0" })

// Lightweight debug logger: only logs when MERKL_DEBUG=1|true or DEBUG contains 'merkl'
const isDebug =
	process.env.MERKL_DEBUG === "1" ||
	process.env.MERKL_DEBUG === "true" ||
	(process.env.DEBUG ?? "").toLowerCase().includes("merkl")
const debugLog = (...args: unknown[]) => {
	if (isDebug) {
		// eslint-disable-next-line no-console
		console.error("[merkl-mcp]", ...args)
	}
}


export const campaignSchema = z
	.object({
		id: z.string({
			description: "Unique campaign id"
		}),
		campaignId: z.string({
			description: "A hash of the campaign, unique per chain. Can be used to identify campaigns across chains",
		}),
		type: z.string(),
		startTimestamp: z.number({
			description: "Timestamp when the campaign starts",
		}),
		endTimestamp: z.number({
			description: "Timestamp when the campaign ends",
		}),
		apr: z.number({
			description: "Annual Percentage Rate (APR) for the campaign, if applicable"
		}).optional(),
		createdAt: z.string({
			description: "Timestamp when the campaign was created",
		}).optional(),
	})
	.passthrough()

// opportunities.search
server.registerTool(
	"opportunities-search",
	{
		title: "Retrieve Multiple Opportunities",
		description: "This endpoint enables you to search for opportunities by providing specific criteria through query parameters.",
		inputSchema: {
			page: z.number({ description: "0-indexed page number" }).min(0).default(0).optional(),
			items: z
				.number({ description: "Number of items returned by page (1-100). Default: 20" })
				.min(1)
				.max(100)
				.default(20)
				.optional(),
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			// tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(true).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			sort: z
				.enum(["apr", "tvl", "rewards", "lastCampaignCreatedAt"])
				.describe("Sort by apr, tvl, rewards or last campaign creation date")
				.optional(),
			order: z.enum(["asc", "desc"]).default("desc").describe("asc to sort ascending, desc to sort descending").optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			results: z
				.array(
					z
						.object({
							id: z.string().describe("Opportunity id"),
							name: z.string().describe("Opportunity name"),
							chainId: z.number().describe("Chain id"),
							type: z.string().describe("Opportunity type"),
							status: z.string().describe("LIVE/PAST/SOON"),
							apr: z.number().nullable().optional(),
							tvl: z.number().nullable().optional(),
							link: z.string().describe("Link to the opportunity"),
							campaigns: z.array(campaignSchema).describe("List of campaigns associated with the opportunity").optional(),
						})
						.passthrough()
				)
				.describe("List of opportunities"),
		},
	},
	async (args) => {
		// if there is no "campaigns" in args, set it to true
		if (_(args).has("campaigns") === false) {
			args = _(args).set("campaigns", true).value()
		}
		const opportunities = await client.listOpportunities(args as OpportunitiesQuery)
		const results = _(opportunities).map(r => ({
			id: r.id,
			name: r.name,
			chainId: r.chainId,
			type: r.type,
			status: r.status,
			apr: r.apr,
			tvl: r.tvl,
			link: `https://app.merkl.xyz/opportunities/${_.lowerCase(r.chain.name)}/${r.type}/${r.identifier}`,
			campaigns: _(r.campaigns).map(c => ({
				id: c.id,
				campaignId: c.campaignId,
				type: c.type,
				startTimestamp: c.startTimestamp,
				endTimestamp: c.endTimestamp,
				apr: c.apr,
				createdAt: c.createdAt,
			})).value()
		})).value()
		const result = { results }
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			structuredContent: result,
		}
	}
)

// opportunities.get
server.registerTool(
	"opportunities-get",
	{
		title: "Get Opportunity",
		description: "GET /v4/opportunities/{id}",
		inputSchema: {
			id: z
				.string({
					description:
						"The id of the opportunity. Pattern: (([0-9]*)-([0-9A-Z]*)-(0x([0-9A-Za-z])*))|([0-9]{1,20})",
				})
				.regex(/(([0-9]*)-([0-9A-Z]*)-(0x([0-9A-Za-z])*))|([0-9]{1,20})/, "Invalid id format"),
			test: z.boolean({ description: "Include test campaigns" }).default(false).optional(),
			point: z.boolean({ description: "Include point campaigns" }).optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(false).optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			opportunity: z
				.object({
					id: z.string(),
					name: z.string(),
					description: z.string().optional(),
					type: z.string(),
					identifier: z.string().describe("Address or identifier of incentivized asset"),
					status: z.string(),
					action: z.string(),
					chainId: z.number(),
					apr: z.number().optional(),
					maxApr: z.number().nullable().optional(),
					dailyRewards: z.number().optional(),
					tvl: z.number().optional(),
					depositUrl: z.string().optional(),
					explorerAddress: z.string().optional(),
					tags: z.array(z.string()).optional(),
					tokens: z.array(z.any()).optional(),
					campaigns: z.array(campaignSchema).optional(),
					lastCampaignCreatedAt: z.union([z.string(), z.number()]).optional(),
				})
				.passthrough()
				.nullable()
				.describe("Opportunity object or null if not found"),
		},
	},
	async ({ id, test, point, tokenTypes, campaigns, excludeSubCampaigns }) => {
		const opportunity = await client.getOpportunity(id as string, {
			test: test as boolean | undefined,
			point: point as boolean | undefined,
			tokenTypes: tokenTypes as ("TOKEN" | "PRETGE" | "POINT")[] | undefined,
			campaigns: campaigns as boolean | undefined,
			excludeSubCampaigns: excludeSubCampaigns as boolean | undefined,
		})
		const result = { opportunity }
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			structuredContent: result,
		}
	}
)

// opportunities.campaigns
server.registerTool(
	"opportunities-campaigns",
	{
		title: "Opportunity Campaigns",
		description: "GET /v4/opportunities/{id}/campaigns",
		inputSchema: {
			id: z
				.string({
					description:
						"The id of the opportunity. Pattern: (([0-9]*)-([0-9A-Z]*)-(0x([0-9A-Za-z])+))|([0-9]{1,20})",
				})
				.regex(/(^([0-9]*)-([0-9A-Z]*)-(0x[0-9A-Za-z]+)$)|(^[0-9]{1,20}$)/, "Invalid id format"),
			test: z.boolean({ description: "Include test campaigns" }).default(false).optional(),
			point: z.boolean({ description: "Include point campaigns" }).optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(false).optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			opportunity: z
				.object({
					id: z.string(),
					name: z.string(),
					description: z.string().optional(),
					type: z.string(),
					identifier: z.string(),
					status: z.string(),
					action: z.string(),
					chainId: z.number(),
					apr: z.number().optional(),
					maxApr: z.number().nullable().optional(),
					dailyRewards: z.number().optional(),
					tvl: z.number().optional(),
					depositUrl: z.string().optional(),
					explorerAddress: z.string().optional(),
					tags: z.array(z.string()).optional(),
					campaigns: z.array(campaignSchema).describe("Related campaigns").optional(),
					tokens: z.array(z.any()).optional(),
				})
				.passthrough()
				.nullable()
				.describe("Opportunity with related campaigns or null if not found"),
		},
	},
	async ({ id, test, point, tokenTypes, campaigns, excludeSubCampaigns }) => {
		const opportunity = await client.getOpportunityCampaigns(id as string, {
			test: test as boolean | undefined,
			point: point as boolean | undefined,
			tokenTypes: tokenTypes as ("TOKEN" | "PRETGE" | "POINT")[] | undefined,
			campaigns: campaigns as boolean | undefined,
			excludeSubCampaigns: excludeSubCampaigns as boolean | undefined,
		})
		const result = { opportunity }
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			structuredContent: result,
		}
	}
)

// opportunities.count
server.registerTool(
	"opportunities-count",
	{
		title: "Count Opportunities",
		description: "GET /v4/opportunities/count",
		inputSchema: {
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(false).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			count: z.number().describe("Number of opportunities matching the filters"),
		},
	},
	async (args) => {
		const count = await client.countOpportunities(args as any)
		const result = { count }
		return {
			content: [
				{ type: "text", text: JSON.stringify(result, null, 2) },
			],
			structuredContent: result,
		}
	}
)

server.registerTool(
	"opportunities-bins-apr",
	{
		title: "APR Bins",
		description: "GET /v4/opportunities/bins/apr",
		inputSchema: {
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			bins: z
				.array(
					z.object({
						label: z.string().describe("APR bin label or range"),
						count: z.number().describe("Number of opportunities in this APR bin"),
					})
				)
				.describe("Distribution of opportunities across APR bins"),
		},
	},
	async (args) => {
		const bins = await client.binsApr(args as any)
		const result = { bins }
		return {
			content: [
				{ type: "text", text: JSON.stringify(result, null, 2) },
			],
			structuredContent: result,
		}
	}
)

server.registerTool(
	"opportunities-bins-tvl",
	{
		title: "TVL Bins",
		description: "GET /v4/opportunities/bins/tvl",
		inputSchema: {
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			bins: z
				.array(
					z.object({
						label: z.string().describe("TVL bin label or range"),
						count: z.number().describe("Number of opportunities in this TVL bin"),
					})
				)
				.describe("Distribution of opportunities across TVL bins"),
		},
	},
	async (args) => {
		const bins = await client.binsTvl(args as any)
		const result = { bins }
		return {
			content: [
				{ type: "text", text: JSON.stringify(result, null, 2) },
			],
			structuredContent: result,
		}
	}
)

server.registerTool(
	"opportunities-aggregate",
	{
		title: "Aggregate Field",
		description: "GET /v4/opportunities/aggregate/{field}",
		inputSchema: {
			field: z.string({ description: "Field to aggregate on (e.g. chainId, status, type, action, tokens, tags, programSlugs, mainProtocolId)" }),
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(false).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			buckets: z
				.array(
					z.object({
						value: z.union([z.string(), z.number(), z.boolean(), z.null()]).describe("Aggregated field value"),
						count: z.number().describe("Number of opportunities matching this value"),
					})
				)
				.describe("Aggregation buckets for the requested field"),
		},
	},
	async ({ field, ...rest }) => {
		const buckets = await client.aggregate(field as string, rest as any)
		const result = { buckets }
		return {
			content: [
				{ type: "text", text: JSON.stringify(result, null, 2) },
			],
			structuredContent: result,
		}
	}
)

server.registerTool(
	"opportunities-aggregate-max",
	{
		title: "Aggregate Max",
		description: "GET /v4/opportunities/aggregate/max/{field}",
		inputSchema: {
			field: z.string({ description: "Numeric field to compute max on (e.g. apr, tvl, dailyRewards)" }),
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(false).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			value: z.number().nullable().describe("Maximum value for the requested field across matching opportunities"),
		},
	},
	async ({ field, ...rest }) => {
		const value = await client.aggregateMax(field as string, rest as any)
		const result = { value }
		return {
			content: [
				{ type: "text", text: JSON.stringify(result, null, 2) },
			],
			structuredContent: result,
		}
	}
)

server.registerTool(
	"opportunities-aggregate-min",
	{
		title: "Aggregate Min",
		description: "GET /v4/opportunities/aggregate/min/{field}",
		inputSchema: {
			field: z.string({ description: "Numeric field to compute min on (e.g. apr, tvl, dailyRewards)" }),
			name: z.string({ description: "Filter by name" }).optional(),
			search: z.string({ description: "Search amongst multiple values (token, protocols, tags, campaigns)" }).optional(),
			campaignId: z.string({ description: "Search the opportunity linked to a given campaignId" }).optional(),
			creatorSlug: z.string().optional(),
			chainId: z
				.string({ description: "A comma separated list of chain ids. Example: ?chainId=1,42161" })
				.regex(/^\d+(,\d+)*$/)
				.optional(),
			action: z
				.string({ description: "A comma separated list actions. Legal values: POOL,HOLD,DROP,LEND,BORROW,LONG,SHORT,SWAP,INVALID" })
				.optional(),
			tokenTypes: z
				.array(z.enum(["TOKEN", "PRETGE", "POINT"]))
				.describe("Filter by token type. Use POINT to include point campaigns and PRETGE to include preTGE campaigns.")
				.optional(),
			point: z.boolean({ description: "Include opportunities with point campaigns" }).optional(),
			type: z.string({ description: "A comma separated list of Opportunity type" }).optional(),
			creatorAddress: z.string({ description: "Filter by creator address" }).optional(),
			tags: z.string({ description: "Filter by tag" }).optional(),
			test: z.boolean({ description: "Include opportunities with test campaigns" }).default(false).optional(),
			minimumTvl: z.number({ description: "Minimum TVL threshold in USD" }).optional(),
			maximumTvl: z.number({ description: "Maximum TVL threshold in USD" }).optional(),
			minimumApr: z.number({ description: "Minimum APR threshold" }).optional(),
			maximumApr: z.number({ description: "Maximum APR threshold" }).optional(),
			status: z
				.string({ description: "A comma separated list of status. Legal values: LIVE,PAST,SOON" })
				.regex(/^(LIVE|PAST|SOON)(,(LIVE|PAST|SOON)){0,2}$/)
				.optional(),
			identifier: z.string({ description: "Filter by identifier (mainParameter)" }).optional(),
			campaigns: z.boolean({ description: "Include campaign data. Will slow down the request" }).default(false).optional(),
			tokens: z.string({ description: "A comma separated list of token symbol. Use to filter by token" }).optional(),
			rewardTokenSymbol: z
				.string({ description: "Filter by opportunity with at least 1 campaign where the reward token has this symbol" })
				.optional(),
			distributionTypes: z
				.array(z.enum(["FIX_REWARD", "MAX_REWARD", "DUTCH_AUCTION"]))
				.describe("Filter by distribution type. Legal values: FIX_REWARD, MAX_REWARD, DUTCH_AUCTION")
				.optional(),
			mainProtocolId: z
				.string({ description: "A comma separated list of protocol ids. See GET /v4/protocols" })
				.optional(),
			programSlugs: z
				.string({ description: "A comma separated list of program ids or slugs. See GET /v4/programs" })
				.optional(),
			chainName: z
				.string({ description: "A comma separated list of chain names. Example: ?chainName=ethereum,arbitrum" })
				.regex(/^[a-zA-Z0-9]+(,[a-zA-Z0-9]+)*$/)
				.optional(),
			excludeSubCampaigns: z.boolean({ description: "Exclude sub-campaigns from the results" }).default(false).optional(),
		},
		outputSchema: {
			value: z.number().nullable().describe("Minimum value for the requested field across matching opportunities"),
		},
	},
	async ({ field, ...rest }) => {
		const value = await client.aggregateMin(field as string, rest as any)
		const result = { value }
		return {
			content: [
				{ type: "text", text: JSON.stringify(result, null, 2) },
			],
			structuredContent: result,
		}
	}
)

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
	// Debug-only log (stderr); stdout is reserved for JSON-RPC
	debugLog("Merkl MCP server (stdio) running")
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error(err)
	process.exit(1)
})
