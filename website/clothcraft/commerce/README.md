# ClothCraft commerce foundation

This directory supplies **server-only** Stripe Checkout endpoints and a durable local credit ledger. It is a foundation, **not** a production purchasing integration. Payments remain unavailable unless a trusted account resolver, Stripe keys, configured products, public origin, and absolute ledger path are provided. The existing `website/clothcraft/serve.mjs` preview server remains unchanged.

## Environment

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLOTHCRAFT_PUBLIC_ORIGIN=https://your-domain.example
CLOTHCRAFT_LEDGER_PATH=/absolute/private/secure/clothcraft-credits.jsonl
CLOTHCRAFT_CREATOR_PRICE_ID=price_...
CLOTHCRAFT_CREATOR_CREDITS=800
CLOTHCRAFT_STUDIO_PRICE_ID=price_...
CLOTHCRAFT_STUDIO_CREDITS=2400
CLOTHCRAFT_PACK_500_PRICE_ID=price_...
CLOTHCRAFT_PACK_500_CREDITS=500
CLOTHCRAFT_PACK_2000_PRICE_ID=price_...
CLOTHCRAFT_PACK_2000_CREDITS=2000
CLOTHCRAFT_PACK_5000_PRICE_ID=price_...
CLOTHCRAFT_PACK_5000_CREDITS=5000
```

Only valid configured SKU/price pairs are enabled. The backend assigns grants from its own configuration and never trusts user supplied price, quantity, credit amount, customer, or account values. Use Stripe Dashboard to configure recurring prices for creator/studio and one-time prices for the three packs. The free BYOK option has no Stripe checkout. Proposed display prices ($12/$29 monthly; $9/$30/$65 packs) are presentation examples only until independently configured and verified in Stripe.

## Node HTTP integration

```js
import {createCommerce} from './commerce/index.mjs';

const commerce = createCommerce({
  // MUST derive identity from a validated server-side session or authentication middleware.
  // Never use client headers, JSON body, URL query, or Stripe customer ID as account identity.
  resolveIdentity: async request => request.authenticatedSession?.accountId ?? null
});

// Inside an async http.createServer handler, BEFORE static file handling:
if (request.url === '/api/commerce/checkout') return commerce.checkout(request,response);
if (request.url === '/api/commerce/webhook') return commerce.webhook(request,response);
if (request.url === '/api/commerce/balance') return commerce.balance(request,response);
```

`POST /api/commerce/checkout` takes exactly `{ "sku": "pack_500" }` (or another configured SKU) and returns `{ "url": "https://checkout.stripe.com/..." }`. Without trusted login identity it returns **503**, even if the browser claims an account. `GET /api/commerce/balance` returns `{ "credits": 123 }` for the authenticated account. The webhook must receive the **unparsed request stream** and the unchanged `Stripe-Signature` header. Set Stripe Dashboard webhook URL to `/api/commerce/webhook`, subscribe to `checkout.session.completed` and `invoice.paid`, and do not put the webhook behind session authentication.

Grants are issued only for paid checkout sessions and paid subscription invoices. Successful subscription checkout records a verified account/subscription association; a paid matching invoice grants recurring credits. Invoice delivery before checkout association returns 503 so Stripe retries. Duplicate payment intent or invoice IDs grant credits only once, including after server restart. No refund, cancellation, chargeback, expiration, usage decrement, or credit reversal handlers are implemented; do not claim these are supported. The JSONL ledger is safe for **one Node process** only; production multi-instance deployments must replace it with a transactional database having a unique grant key and atomic balance changes. Restrict filesystem access to the private ledger and keep all Stripe secrets out of static hosting.

Run focused checks with `node --test website/clothcraft/commerce/index.test.mjs` from the repo root.
