import { createPaymentIntent, getPolicyProfile, type PolicyProfileName } from "../sdk/index.js";

const profiles: PolicyProfileName[] = ["sandbox", "balanced", "strict"];

async function main() {
  const results = await Promise.all(
    profiles.map(async (profile) => {
      const intent = await createPaymentIntent(
        {
          agent: "deepseek",
          token: "SOL",
          amount: 20,
          settle: "USDC",
        },
        {
          policy: getPolicyProfile(profile),
          idFactory: () => `intent_sdk_${profile}_policy_example`,
        }
      );

      return {
        profile,
        decision: intent.decision,
        nextAction: intent.nextAction,
        riskLevel: intent.riskLevel,
        reasons: intent.reasons,
      };
    })
  );

  console.log(JSON.stringify(results, null, 2));
}

void main();
