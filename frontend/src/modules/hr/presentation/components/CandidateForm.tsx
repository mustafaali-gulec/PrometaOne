/**
 * CandidateForm — yeni aday kaydı formu.
 *
 * Controlled form. Submit callback'i parent'a body gönderir.
 * Email/phone client-side basit doğrulama; gerçek validasyon backend'de
 * (PhoneNumber TR format VO ile).
 */
import { useState } from 'react';

import type { CandidateSource } from '../../application/dto/HrDtos';

export interface CandidateFormValues {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  cvUrl: string | null;
  notes: string | null;
}

export interface CandidateFormProps {
  onSubmit: (values: CandidateFormValues) => Promise<void>;
  onCancel?: () => void;
}

const SOURCES: { value: CandidateSource; label: string }[] = [
  { value: 'referral', label: 'Tavsiye' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'jobboard', label: 'Kariyer Sitesi' },
  { value: 'direct', label: 'Doğrudan' },
  { value: 'agency', label: 'Ajans' },
  { value: 'other', label: 'Diğer' },
];

export function CandidateForm({ onSubmit, onCancel }: CandidateFormProps): JSX.Element {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [source, setSource] = useState<CandidateSource>('direct');
  const [cvUrl, setCvUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();
    setError(null);
    if (firstName.trim().length === 0 || lastName.trim().length === 0) {
      setError('Ad ve soyad zorunlu.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().length === 0 ? null : email.trim(),
        phone: phone.trim().length === 0 ? null : phone.trim(),
        source,
        cvUrl: cvUrl.trim().length === 0 ? null : cvUrl.trim(),
        notes: notes.trim().length === 0 ? null : notes.trim(),
      });
      // Başarılı submit sonrası form'u temizle
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setSource('direct');
      setCvUrl('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(ev) => void handleSubmit(ev)}
      style={{
        display: 'grid',
        gap: 10,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        maxWidth: 480,
      }}
    >
      {error !== null ? (
        <div
          style={{
            padding: 8,
            background: 'var(--danger-bg, #fef2f2)',
            color: 'var(--danger, #b91c1c)',
            border: '1px solid var(--danger, #fca5a5)',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}
      <Field label="Ad *">
        <input
          type="text"
          required
          value={firstName}
          onChange={(ev) => setFirstName(ev.target.value)}
          style={inputStyle()}
        />
      </Field>
      <Field label="Soyad *">
        <input
          type="text"
          required
          value={lastName}
          onChange={(ev) => setLastName(ev.target.value)}
          style={inputStyle()}
        />
      </Field>
      <Field label="E-posta">
        <input
          type="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          style={inputStyle()}
        />
      </Field>
      <Field label="Telefon (TR)">
        <input
          type="tel"
          placeholder="0532 123 45 67"
          value={phone}
          onChange={(ev) => setPhone(ev.target.value)}
          style={inputStyle()}
        />
      </Field>
      <Field label="Kaynak">
        <select
          value={source}
          onChange={(ev) => setSource(ev.target.value as CandidateSource)}
          style={inputStyle()}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="CV bağlantısı">
        <input
          type="url"
          value={cvUrl}
          onChange={(ev) => setCvUrl(ev.target.value)}
          placeholder="https://…"
          style={inputStyle()}
        />
      </Field>
      <Field label="Notlar">
        <textarea
          rows={3}
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          style={{ ...inputStyle(), resize: 'vertical' }}
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" disabled={submitting} style={primaryBtnStyle()}>
          {submitting ? 'Kaydediliyor…' : 'Aday Kaydet'}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={submitting} style={btnStyle()}>
            İptal
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-muted, #6b7280)', fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    padding: '8px 10px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'inherit',
  };
}

function btnStyle(): React.CSSProperties {
  return {
    padding: '8px 16px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    cursor: 'pointer',
    fontSize: 13,
  };
}

function primaryBtnStyle(): React.CSSProperties {
  return {
    ...btnStyle(),
    background: 'var(--accent, #0066cc)',
    color: '#fff',
    border: 'none',
  };
}
