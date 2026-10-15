import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
// npm workspaces hoist `next` to the repository. Turbopack will not resolve
// packages outside this root, and Render checks the repository out under a
// folder named src, so the root stays the repository rather than a parent.
const root = path.resolve(frontendDir, '..');

export default {
  poweredByHeader: false,
  agentRules: false,
  outputFileTracingRoot: root,
  turbopack: { root },
};
