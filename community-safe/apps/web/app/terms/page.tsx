import type { Metadata } from 'next';
import { LegalPage } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <h2>The service</h2>
      <p>Community Safe is an independent backup channel between creators and the people who choose to follow them. It is free for followers. Creators subscribe to a yearly plan.</p>
      <h2>Followers</h2>
      <p>You choose who you follow and which alerts you receive. You can unfollow, change your preferences or delete your account at any time.</p>
      <h2>Creators</h2>
      <p>You must be who you claim to be. Alerts can only be sent after your identity has been verified. Impersonating a person, brand or organisation leads to suspension.</p>
      <p>SOS alerts are reserved for real emergencies about your accounts or channels. Important announcements are limited by your plan. Using SOS alerts to bypass announcement limits, sending spam, or linking to deceptive or malicious destinations is prohibited and may lead to blocked alerts and suspension.</p>
      <p>Community Safe cannot import followers from social platforms: members join voluntarily through your link.</p>
      <h2>Delivery</h2>
      <p>Push notifications rely on Apple, Google and each phone's settings. We do our best to deliver quickly but cannot guarantee that every device receives every alert, or receives it immediately.</p>
      <h2>Plans and capacity</h2>
      <p>If your community grows beyond your plan, nobody is removed and SOS alerts keep working; you will be asked to upgrade to keep sending announcements.</p>
      <h2>Reporting</h2>
      <p>Any profile or alert can be reported from the app. We review reports and may suspend accounts or block alerts.</p>
    </LegalPage>
  );
}
