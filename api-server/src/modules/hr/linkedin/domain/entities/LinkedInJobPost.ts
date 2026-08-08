/**
 * LinkedInJobPost — bir ilanın bir kanala gönderim kaydı.
 *
 * (companyId, postingRef, channel) benzersiz; tekrar yayınlama aynı satırı
 * günceller. UI'daki "LinkedIn'de yayında / hata" rozeti bu kayıttan beslenir.
 */
import type { LinkedInChannel } from '../valueObjects/LinkedInChannel.js';
import type { LinkedInPostStatus } from '../valueObjects/LinkedInPostStatus.js';

export interface LinkedInJobPostProps {
  id: number | null;
  companyId: number;
  postingRef: string;
  channel: LinkedInChannel;
  status: LinkedInPostStatus;
  postUrn: string | null;
  postUrl: string | null;
  title: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class LinkedInJobPost {
  private constructor(private readonly props: LinkedInJobPostProps) {}

  static create(props: LinkedInJobPostProps): LinkedInJobPost {
    return new LinkedInJobPost(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get postingRef(): string {
    return this.props.postingRef;
  }
  get channel(): LinkedInChannel {
    return this.props.channel;
  }
  get status(): LinkedInPostStatus {
    return this.props.status;
  }
  get postUrl(): string | null {
    return this.props.postUrl;
  }

  toJSON(): Omit<LinkedInJobPostProps, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  } {
    return {
      ...this.props,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
