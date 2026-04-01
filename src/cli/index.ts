#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./commands/init.js";
import { dev } from "./commands/dev.js";

const program = new Command();
program
  .name("maestro")
  .description("AI-driven orchestrator for autonomous software development")
  .version("0.1.0");

program.command("init").description("Initialize Maestro in current git repo").action(init);
program.command("dev").description("Start the Maestro dev server").option("-p, --port <port>", "Port number", "4200").action(dev);
program.command("status").description("Show current status").action(() => console.log("Coming soon"));
program.command("wake").description("Wake the orchestrator").action(() => console.log("Coming soon"));
program.command("stop").description("Stop an agent").argument("[agent]", "Agent name").action(() => console.log("Coming soon"));
program.command("doctor").description("Check environment").action(() => console.log("Coming soon"));

program.parse();
