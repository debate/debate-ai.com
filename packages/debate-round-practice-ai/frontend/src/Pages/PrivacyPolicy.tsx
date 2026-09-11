// src/Pages/PrivacyPolicy.tsx
import TermsOfService from './TermsOfService';

/**
 * `/privacy-policy` and `/terms-of-service` are the same combined document —
 * see {@link TermsOfService}. Both routes exist so links to either keep working.
 */
function PrivacyPolicy() {
  return <TermsOfService />;
}

export default PrivacyPolicy;
