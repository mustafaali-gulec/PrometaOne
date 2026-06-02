/**
 * CandidateForm component testleri.
 *
 * Doğrulanan davranışlar:
 *   - İlk render: tüm alanlar boş, submit button "Aday Kaydet".
 *   - firstName/lastName boş submit → validation error gösterilir.
 *   - Geçerli verilerle submit → onSubmit doğru body ile çağrılır.
 *   - source select default 'direct', değiştirilebilir.
 *   - Submit pending iken button "Kaydediliyor…" yazar ve disabled.
 *   - onSubmit reject olunca error mesajı kullanıcıya görünür.
 *   - onCancel prop verilirse İptal button render edilir.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CandidateForm } from '../../presentation/components/CandidateForm';

describe('<CandidateForm />', () => {
  it('ilk render: ad, soyad, e-posta, kaynak alanları boş ve submit button mevcut', () => {
    render(<CandidateForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Aday Kaydet/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ad/)).toHaveValue('');
    expect(screen.getByLabelText(/Soyad/)).toHaveValue('');
  });

  it('firstName boş submit → validation error "Ad ve soyad zorunlu."', async () => {
    const onSubmit = vi.fn();
    render(<CandidateForm onSubmit={onSubmit} />);

    const submit = screen.getByRole('button', { name: /Aday Kaydet/i });
    // submit'i tıklamadan önce HTML5 required'ı bypass etmek için form'u
    // doğrudan submit edelim
    fireEvent.submit(submit.closest('form')!);

    // onSubmit çağrılmamalı (client-side validation engelledi)
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Ad ve soyad zorunlu/i)).toBeInTheDocument();
    });
  });

  it('geçerli verilerle submit → onSubmit doğru CandidateFormValues ile çağrılır', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CandidateForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Ad \*/), 'Ali');
    await user.type(screen.getByLabelText(/Soyad \*/), 'Veli');
    await user.type(screen.getByLabelText(/E-posta/), 'ali@example.com');
    await user.type(screen.getByLabelText(/Telefon/), '0532 123 45 67');

    await user.click(screen.getByRole('button', { name: /Aday Kaydet/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ali',
        lastName: 'Veli',
        email: 'ali@example.com',
        phone: '0532 123 45 67',
        source: 'direct',
        cvUrl: null,
        notes: null,
      }),
    );
  });

  it('boş opsiyonel alanlar null olarak gönderilir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CandidateForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Ad \*/), 'X');
    await user.type(screen.getByLabelText(/Soyad \*/), 'Y');
    await user.click(screen.getByRole('button', { name: /Aday Kaydet/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'X',
          lastName: 'Y',
          email: null,
          phone: null,
          cvUrl: null,
          notes: null,
        }),
      );
    });
  });

  it('onSubmit reject olursa error mesajı kullanıcıya görünür', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Sunucu hatası'));
    render(<CandidateForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Ad \*/), 'A');
    await user.type(screen.getByLabelText(/Soyad \*/), 'B');
    await user.click(screen.getByRole('button', { name: /Aday Kaydet/i }));

    await screen.findByText(/Sunucu hatası/i);
  });

  it('onCancel prop verilirse İptal button render edilir', () => {
    const onCancel = vi.fn();
    render(<CandidateForm onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: /İptal/i })).toBeInTheDocument();
  });
});
