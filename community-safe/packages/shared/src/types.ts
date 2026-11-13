import type { AlertKind } from './push';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type AlertStatus = 'queued' | 'sending' | 'sent' | 'blocked' | 'failed';

export interface CreatorProfile {
  id: string;
  owner_user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  category: string;
  verification_status: VerificationStatus;
  status: 'active' | 'suspended';
  plan_id: string;
  member_count: number;
  created_at: string;
}

export interface Alert {
  id: string;
  creator_id: string;
  kind: AlertKind;
  reason: string | null;
  message: string;
  link_url: string | null;
  status: AlertStatus;
  blocked_reason: string | null;
  recipients_total: number;
  created_at: string;
  sent_at: string | null;
}

export interface NotificationPreferences {
  creator_id: string;
  user_id: string;
  sos_enabled: boolean;
  announcements_enabled: boolean;
}

export interface DashboardStats {
  members_total: number;
  members_today: number;
  members_week: number;
  members_month: number;
  members_notifications_allowed: number;
  devices_with_valid_token: number;
  members_sos_enabled: number;
  members_announcements_enabled: number;
  alerts_sent: number;
  announcements_this_month: number;
  link_clicks: number;
  clicks_by_source: Record<string, number>;
  members_by_source: Record<string, number>;
  growth: { day: string; count: number }[];
  plan: { id: string; name: string; member_limit: number | null; announcements_per_month: number | null };
}

export interface DeliveryStats {
  status: AlertStatus;
  blocked_reason: string | null;
  recipients_total: number;
  pending: number;
  accepted_by_provider: number;
  no_device: number;
  failed: number;
  delivered_to_device: number;
  opened: number;
  link_opened: number;
}
