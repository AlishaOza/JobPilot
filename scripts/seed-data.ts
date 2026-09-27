import { loadEnv } from "../src/config/env";
import { getPaths } from "../src/config/paths";
import { ensureDataFiles } from "../src/excel/templates";

async function main(): Promise<void> {
  loadEnv();
  await ensureDataFiles();
  const paths = getPaths();
  console.log(JSON.stringify(paths, null, 2));
}

void main();
