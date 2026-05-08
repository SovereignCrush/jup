# Security

`jup.sh` is currently a static prototype. It does not execute real payments,
hold funds, or store private keys.

If you find a security issue, please do not open a public issue with exploit
details.

Instead, contact the maintainer privately through GitHub.

## Current Safety Assumptions

- No custody of user funds.
- No private keys handled by this prototype.
- No real payment execution in V1.
- No production API or database in this repository.

Future payment-related code should keep routes, recipients, amounts, token
inputs, and policy decisions inspectable.
