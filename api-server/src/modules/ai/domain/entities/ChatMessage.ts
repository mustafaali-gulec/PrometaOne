/**
 * ChatMessage — chat geçmişinin tek bir mesajı.
 *
 * Immutable. Geçerlilik kontrolü `create()` factory'sinde.
 */
import type { ChatRole } from '../valueObjects/ChatRole.js';

export interface ChatMessageProps {
  role: ChatRole;
  content: string;
}

export class ChatMessage {
  private constructor(private readonly props: Readonly<ChatMessageProps>) {}

  static create(props: ChatMessageProps): ChatMessage {
    if (props.content.length === 0) {
      throw new Error('ChatMessage.content boş olamaz');
    }
    if (props.content.length > 100_000) {
      throw new Error('ChatMessage.content 100.000 karakteri geçemez');
    }
    return new ChatMessage(props);
  }

  get role(): ChatRole {
    return this.props.role;
  }

  get content(): string {
    return this.props.content;
  }

  toJSON(): Readonly<ChatMessageProps> {
    return { ...this.props };
  }
}
