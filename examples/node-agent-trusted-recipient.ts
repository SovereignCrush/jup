import {
  createPaymentIntent,
  getPolicyProfile,
  withTrustedRecipients,
} from "../sdk/index.js";

async function main() {
  const trustedRecipient = "api.vendor.example";
  const policy = withTrustedRecipients(getPolicyProfile("balanced"), [trustedRecipient]);

  const intent = await createPaymentIntent(
    {
      agent: "deepseek",
      token: "SOL",
      amount: 2,
      settle: "USDC",
      recipient: trustedRecipient,
    },
    {
      policy,
      idFactory: () => "intent_sdk_trusted_recipient_example",
    }
  );

  console.log(
    JSON.stringify(
      {
        recipient: intent.recipient,
        decision: intent.decision,
        nextAction: intent.nextAction,
        riskLevel: intent.riskLevel,
        policyChecks: intent.policyChecks,
      },
      null,
      2
    )
  );
}

void main();
