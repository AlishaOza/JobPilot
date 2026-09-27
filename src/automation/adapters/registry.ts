import { IndeedApplicationAdapter } from "./indeed-adapter";
import { GenericApplicationAdapter } from "./generic-adapter";
import { selectApplicationAdapter, type ApplicationAdapter } from "./application-adapter";

export const DEFAULT_APPLICATION_ADAPTERS: ApplicationAdapter[] = [
  new IndeedApplicationAdapter(),
  new GenericApplicationAdapter(),
];

export function routeApplicationAdapter(applyUrl: string, adapters: ApplicationAdapter[] = DEFAULT_APPLICATION_ADAPTERS): ApplicationAdapter {
  return selectApplicationAdapter(adapters, applyUrl);
}
