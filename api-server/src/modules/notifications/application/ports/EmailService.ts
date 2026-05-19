/**
 * EmailService — port (interface).
 *
 * Concrete implementation infrastructure/email/NodemailerEmailService.ts.
 */

export interface SendEmailRequest {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailService {
  send(req: SendEmailRequest): Promise<void>;
}
