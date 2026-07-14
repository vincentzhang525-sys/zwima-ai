import { finalizeReport } from "./helpers/results";

export default async function globalTeardown() {
  finalizeReport();
}
