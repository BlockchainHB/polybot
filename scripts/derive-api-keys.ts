import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

async function main() {
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
  if (!privateKey) {
    console.error("POLYMARKET_PRIVATE_KEY env variable is required");
    process.exit(1);
  }

  const wallet = new Wallet(privateKey);
  console.log("Deriving API keys for wallet:", wallet.address);

  const client = new ClobClient(
    "https://clob.polymarket.com",
    137,
    wallet
  );

  const apiKeys = await client.createOrDeriveApiKey();
  console.log("\nAPI Credentials (add these to your .env):\n");
  console.log(`POLYMARKET_API_KEY=${(apiKeys as any).apiKey}`);
  console.log(`POLYMARKET_API_SECRET=${(apiKeys as any).secret}`);
  console.log(`POLYMARKET_API_PASSPHRASE=${(apiKeys as any).passphrase}`);
}

main().catch((err) => {
  console.error("Failed to derive API keys:", err);
  process.exit(1);
});
