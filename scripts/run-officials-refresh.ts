import { spawnSync } from "node:child_process";

function forwardedArgs() {
  return process.argv.slice(2).filter((arg) => arg !== "--");
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: "inherit", env: process.env });
  if (result.status !== 0 || result.error) throw new Error(result.error?.message ?? `${command} ${args.join(" ")} failed with ${result.status}`);
}

const args = forwardedArgs();
run("npm", ["run", "officials:sources"]);
run("node", ["--import", "tsx", "scripts/retrieve-official-directory-sources.ts", ...args]);
run("node", ["--import", "tsx", "scripts/reconcile-carson-city-officials.ts"]);
run("npm", ["run", "officials:audit"]);
