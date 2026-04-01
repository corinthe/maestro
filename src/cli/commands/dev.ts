import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

export async function dev(options: { port: string }): Promise<void> {
  const cwd = process.cwd();
  const maestroDir = path.join(cwd, ".maestro");

  // Check that .maestro/ exists
  if (!fs.existsSync(maestroDir)) {
    console.log(pc.red("Error: Maestro is not initialized in this repository."));
    console.log(pc.dim("Run `maestro init` first."));
    process.exit(1);
  }

  const port = options.port;
  console.log(pc.bold(`Starting Maestro dev server on port ${port}...`));
  console.log(pc.cyan(`  http://localhost:${port}`));
  console.log(pc.dim("Press Ctrl+C to stop.\n"));

  const child = spawn("npx", ["next", "dev", "--port", port], {
    cwd,
    stdio: "inherit",
    shell: true,
  });

  const cleanup = () => {
    child.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  child.on("error", (err) => {
    console.log(pc.red(`Failed to start dev server: ${err.message}`));
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
