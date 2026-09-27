import { hostnameOf } from "../../jobs/apply-destination";
import { GenericApplicationAdapter } from "./generic-adapter";

export class IndeedApplicationAdapter extends GenericApplicationAdapter {
  override readonly name = "indeed";

  override canHandle(applyUrl: string): boolean {
    return hostnameOf(applyUrl).includes("indeed");
  }
}
