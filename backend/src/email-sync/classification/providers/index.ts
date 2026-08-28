import type { EmailInput } from '../types';
import type { EmailProvider } from './types';
import { jobStreetProvider } from './jobstreet';
import { linkedInProvider } from './linkedin';
import { indeedProvider } from './indeed';
import { genericProvider } from './generic';

export type { EmailProvider, ProviderExtraction } from './types';
export { genericProvider } from './generic';

// Checked in order; genericProvider.matches() is always true, so it's not
// listed here — resolveProvider falls back to it explicitly instead.
const PLATFORM_PROVIDERS: EmailProvider[] = [jobStreetProvider, linkedInProvider, indeedProvider];

export function resolveProvider(input: EmailInput): EmailProvider {
  return PLATFORM_PROVIDERS.find((provider) => provider.matches(input)) ?? genericProvider;
}
