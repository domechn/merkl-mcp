import { MerklClient } from "../src/merklClient.js";

async function main() {
  const client = new MerklClient({});
  const list = await client.listOpportunities({ items: 1 });
  // eslint-disable-next-line no-console
  console.log("opportunities sample:", JSON.stringify(list).slice(0, 300) + "...");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
