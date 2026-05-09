import { createJupiterQuoteProvider, createPaymentIntent } from "../sdk/index.js";

async function main() {
  const intent = await createPaymentIntent(
    {
      agent: "deepseek",
      token: "SOL",
      amount: 20,
      settle: "USDC",
    },
    {
      quoteProvider: createJupiterQuoteProvider({
        apiKey: process.env.JUPITER_API_KEY,
      }),
    }
  );

  console.log(JSON.stringify(intent, null, 2));
}

void main();
