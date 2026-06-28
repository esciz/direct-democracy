import "@/lib/env/load-local-env";

import { purgeExpiredVerificationEvidence } from "@/lib/identity/evidence";

console.log(JSON.stringify(purgeExpiredVerificationEvidence(), null, 2));
