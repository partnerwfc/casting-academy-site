import type { Metadata } from 'next';
import { LegalPage } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What Community Safe does</h2>
      <p>Community Safe lets you follow creators and receive the alerts you allow: SOS alerts (hacked, suspended or deleted account) and, if you opt in, rare important announcements.</p>
      <h2>Data we process</h2>
      <p><strong>Account:</strong> your email address, an optional display name, your language.</p>
      <p><strong>Communities:</strong> the creators you follow and your notification preferences for each of them.</p>
      <p><strong>Devices:</strong> a random installation identifier, the platform (iOS/Android), your notification permission and a push token used only to deliver alerts. Invalid tokens are deleted.</p>
      <p><strong>Alerts:</strong> whether an alert was sent to you, opened, and whether you opened its link.</p>
      <p><strong>Link statistics:</strong> anonymous click counters per creator link. We store no IP address and no advertising identifier.</p>
      <h2>What we never do</h2>
      <p>We do not sell personal data. Creators never receive the list or contact details of their members: they only see aggregated counts. We do not show ads and we do not build advertising profiles.</p>
      <h2>Legal bases</h2>
      <p>Performance of the service you asked for (account, follows, alerts) and your consent for each notification category, which you can withdraw at any time, creator by creator. Each consent change is recorded.</p>
      <h2>Retention</h2>
      <p>Account data is kept while your account exists. Deleting your account deletes your follows, preferences, devices and tokens. Security audit logs are kept for a limited period without your identifier.</p>
      <h2>Your rights</h2>
      <p>You can access, export and delete your data from the app (Profile → Export my data / Delete my account), change your preferences, and lodge a complaint with your data protection authority.</p>
      <h2>Children</h2>
      <p>Community Safe is not intended for people under 16.</p>
      <h2>Processors</h2>
      <p>Hosting and database: Supabase. Push delivery: Expo, Apple (APNs) and Google (FCM). Payments for creators: Stripe. The full list, locations and safeguards will be published here before launch.</p>
    </LegalPage>
  );
}
