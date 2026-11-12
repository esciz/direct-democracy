import { archiveBackend, r2Configuration } from "@/lib/dataops/archive-store";

const backend = archiveBackend();
if (backend === "r2") r2Configuration();
else if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("missing_civic_archive_setting:BLOB_READ_WRITE_TOKEN");
if (process.argv.includes("--database") && !process.env.DATABASE_URL) throw new Error("missing_worker_setting:DATABASE_URL");
console.log(`Civic archive configuration present: ${backend}`);
