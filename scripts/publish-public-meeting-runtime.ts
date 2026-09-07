import { writePublicMeetingRuntimeArtifacts } from "@/lib/public-meetings/runtime-artifacts";
writePublicMeetingRuntimeArtifacts().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error); process.exitCode = 1; });
