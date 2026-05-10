import {
  createPaymentIntent,
  explainPolicyDecision,
  getPolicyProfile,
  withTrustedRecipients,
} from "../sdk/index.js";

async function main() {
  const reviewIntent = await createPaymentIntent(
    {
      agent: "deepseek",
      token: "SOL",
      amount: 20,
      settle: "USDC",
    },
    {
      policy: getPolicyProfile("balanced"),
      idFactory: () => "intent_sdk_explain_review_example",
    }
  );

  const trustedRecipient = "api.vendor.example";
  const autoPayIntent = await createPaymentIntent(
    {
      agent: "deepseek",
      token: "SOL",
      amount: 2,
      settle: "USDC",
      recipient: trustedRecipient,
    },
    {
      policy: withTrustedRecipients(getPolicyProfile("balanced"), [trustedRecipient]),
      idFactory: () => "intent_sdk_explain_auto_example",
    }
  );

  console.log(
    JSON.stringify(
      {
        review: explainPolicyDecision(reviewIntent),
        autoPay: explainPolicyDecision(autoPayIntent),
      },
      null,
      2
    )
  );
}

void main();
