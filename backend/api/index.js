/**
 * The Vercel function entry for the whole API.
 *
 * Plain CommonJS, and deliberately so: it is loaded by the platform's runtime,
 * not by Nest's build, and TypeScript compiled by a bundler that strips
 * decorator metadata would leave TypeORM with no entity metadata at runtime.
 * `nest build` produces dist/ during the build step with the project's own
 * tsconfig — decorators intact — and this file just points at the result.
 *
 * vercel.json rewrites every path here, so `req.url` is the original request
 * path and the Express instance inside routes it exactly as it would locally.
 */
const handler = require('../dist/serverless').default;

module.exports = handler;
