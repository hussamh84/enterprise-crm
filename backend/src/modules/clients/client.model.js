/**
 * Client fields composed into the main Client model in `../index.js` via `makeEntityModel`.
 * Sequential `clientNumber` (Number) is assigned per-tenant on create (POST /clients, lead → client).
 * Uniqueness: compound index `{ tenantId, clientNumber }` in `index.js` (per-tenant sequence).
 * API exposes padded `clientCode` via Mongoose virtual on the Client schema in `index.js`.
 */

const clientNumberField = {
  clientNumber: {
    type: Number,
    sparse: true,
  },
};

module.exports = { clientNumberField };
