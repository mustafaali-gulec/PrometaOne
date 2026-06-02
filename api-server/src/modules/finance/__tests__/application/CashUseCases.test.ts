/**
 * Cash use-case testleri: account CRUD, kasa entry, transfer, cash position.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreateBankAccountUseCase,
  CreateKasaAccountUseCase,
  ListBankAccountsUseCase,
} from '../../application/useCases/AccountUseCases.js';
import {
  CreateTransferUseCase,
  GetCashPositionUseCase,
  ListTransfersUseCase,
  RecordKasaEntryUseCase,
} from '../../application/useCases/CashFlowUseCases.js';
import {
  KasaAccountNotFoundError,
  TransferEndpointNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import {
  FixedClock,
  InMemoryBankAccountRepository,
  InMemoryKasaAccountRepository,
  InMemoryKasaEntryRepository,
  InMemoryTransferRepository,
} from '../fakes.js';

describe('Cash use-cases', () => {
  let banks: InMemoryBankAccountRepository;
  let kasas: InMemoryKasaAccountRepository;
  let entries: InMemoryKasaEntryRepository;
  let transfers: InMemoryTransferRepository;
  let clock: FixedClock;

  beforeEach(() => {
    banks = new InMemoryBankAccountRepository();
    kasas = new InMemoryKasaAccountRepository();
    entries = new InMemoryKasaEntryRepository();
    transfers = new InMemoryTransferRepository();
    clock = new FixedClock();
  });

  describe('CreateBankAccountUseCase', () => {
    it('happy: banka hesabı oluşur', async () => {
      const uc = new CreateBankAccountUseCase(banks);
      const dto = await uc.execute({
        companyId: 100,
        bankId: 5,
        name: 'Vadesiz',
        currency: 'TRY',
        openingBalance: 1000,
      });
      assert.equal(dto.name, 'Vadesiz');
      assert.equal(dto.openingBalance, '1000.00');
      assert.ok(dto.active);
    });

    it('listede görünür', async () => {
      await new CreateBankAccountUseCase(banks).execute({
        companyId: 100,
        bankId: 5,
        name: 'A',
        currency: 'TRY',
      });
      const list = await new ListBankAccountsUseCase(banks).execute({ companyId: 100 });
      assert.equal(list.length, 1);
    });
  });

  describe('RecordKasaEntryUseCase', () => {
    it("happy: kasa girişi kaydedilir (hesap currency'sinde)", async () => {
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'Merkez',
        currency: 'TRY',
      });
      const uc = new RecordKasaEntryUseCase(kasas, entries, clock);
      const dto = await uc.execute({
        companyId: 100,
        kasaAccountId: kasa.id,
        date: '2026-01-15',
        type: 'in',
        amount: 250.75,
        actorUserId: 7,
      });
      assert.equal(dto.amount, '250.75');
      assert.equal(dto.type, 'in');
    });

    it('edge: olmayan kasa hesabı → KasaAccountNotFoundError', async () => {
      const uc = new RecordKasaEntryUseCase(kasas, entries, clock);
      await assert.rejects(
        uc.execute({
          companyId: 100,
          kasaAccountId: 999,
          date: '2026-01-15',
          type: 'in',
          amount: 100,
          actorUserId: null,
        }),
        KasaAccountNotFoundError,
      );
    });
  });

  describe('CreateTransferUseCase', () => {
    it('happy: banka → kasa transferi', async () => {
      const bank = await new CreateBankAccountUseCase(banks).execute({
        companyId: 100,
        bankId: 5,
        name: 'Banka',
        currency: 'TRY',
        openingBalance: 5000,
      });
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'Kasa',
        currency: 'TRY',
      });
      const uc = new CreateTransferUseCase(banks, kasas, transfers, clock);
      const dto = await uc.execute({
        companyId: 100,
        date: '2026-01-15',
        fromType: 'bank',
        fromId: bank.id,
        toType: 'kasa',
        toId: kasa.id,
        fromAmount: 1000,
        toAmount: 1000,
        fromCurrency: 'TRY',
        toCurrency: 'TRY',
        actorUserId: null,
      });
      assert.equal(dto.fromType, 'bank');
      assert.equal(dto.toType, 'kasa');
      assert.equal(dto.fromAmount, '1000.00');
    });

    it('happy: multi-currency (TRY banka → USD kasa farklı tutar)', async () => {
      const bank = await new CreateBankAccountUseCase(banks).execute({
        companyId: 100,
        bankId: 5,
        name: 'TRY Banka',
        currency: 'TRY',
        openingBalance: 100000,
      });
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'USD Kasa',
        currency: 'USD',
      });
      const uc = new CreateTransferUseCase(banks, kasas, transfers, clock);
      const dto = await uc.execute({
        companyId: 100,
        date: '2026-01-15',
        fromType: 'bank',
        fromId: bank.id,
        toType: 'kasa',
        toId: kasa.id,
        fromAmount: 35000,
        toAmount: 1000,
        fromCurrency: 'TRY',
        toCurrency: 'USD',
        actorUserId: null,
      });
      assert.equal(dto.fromAmount, '35000.00');
      assert.equal(dto.toAmount, '1000.00');
    });

    it('edge: olmayan kaynak hesap → TransferEndpointNotFoundError', async () => {
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'Kasa',
        currency: 'TRY',
      });
      const uc = new CreateTransferUseCase(banks, kasas, transfers, clock);
      await assert.rejects(
        uc.execute({
          companyId: 100,
          date: '2026-01-15',
          fromType: 'bank',
          fromId: 999,
          toType: 'kasa',
          toId: kasa.id,
          fromAmount: 100,
          toAmount: 100,
          fromCurrency: 'TRY',
          toCurrency: 'TRY',
          actorUserId: null,
        }),
        TransferEndpointNotFoundError,
      );
    });

    it('edge: aynı hesaba transfer → Transfer.create fırlatır', async () => {
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'Kasa',
        currency: 'TRY',
      });
      const uc = new CreateTransferUseCase(banks, kasas, transfers, clock);
      await assert.rejects(
        uc.execute({
          companyId: 100,
          date: '2026-01-15',
          fromType: 'kasa',
          fromId: kasa.id,
          toType: 'kasa',
          toId: kasa.id,
          fromAmount: 100,
          toAmount: 100,
          fromCurrency: 'TRY',
          toCurrency: 'TRY',
          actorUserId: null,
        }),
      );
    });
  });

  describe('GetCashPositionUseCase', () => {
    it('kasa hesabı: opening + entries + transferler', async () => {
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'Kasa',
        currency: 'TRY',
        openingBalance: 1000,
      });
      const bank = await new CreateBankAccountUseCase(banks).execute({
        companyId: 100,
        bankId: 5,
        name: 'Banka',
        currency: 'TRY',
        openingBalance: 5000,
      });
      // Kasa girişi +500
      await new RecordKasaEntryUseCase(kasas, entries, clock).execute({
        companyId: 100,
        kasaAccountId: kasa.id,
        date: '2026-01-15',
        type: 'in',
        amount: 500,
        actorUserId: null,
      });
      // Banka → kasa transfer +2000
      await new CreateTransferUseCase(banks, kasas, transfers, clock).execute({
        companyId: 100,
        date: '2026-01-16',
        fromType: 'bank',
        fromId: bank.id,
        toType: 'kasa',
        toId: kasa.id,
        fromAmount: 2000,
        toAmount: 2000,
        fromCurrency: 'TRY',
        toCurrency: 'TRY',
        actorUserId: null,
      });

      const pos = await new GetCashPositionUseCase(banks, kasas, entries, transfers).execute({
        companyId: 100,
        endpointType: 'kasa',
        accountId: kasa.id,
      });
      // 1000 + 500 + 2000 = 3500
      assert.equal(pos.currentBalance, '3500.00');
      assert.equal(pos.openingBalance, '1000.00');
    });

    it('banka hesabı: giden transfer bakiyeyi düşürür', async () => {
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'Kasa',
        currency: 'TRY',
      });
      const bank = await new CreateBankAccountUseCase(banks).execute({
        companyId: 100,
        bankId: 5,
        name: 'Banka',
        currency: 'TRY',
        openingBalance: 5000,
      });
      await new CreateTransferUseCase(banks, kasas, transfers, clock).execute({
        companyId: 100,
        date: '2026-01-16',
        fromType: 'bank',
        fromId: bank.id,
        toType: 'kasa',
        toId: kasa.id,
        fromAmount: 2000,
        toAmount: 2000,
        fromCurrency: 'TRY',
        toCurrency: 'TRY',
        actorUserId: null,
      });
      const pos = await new GetCashPositionUseCase(banks, kasas, entries, transfers).execute({
        companyId: 100,
        endpointType: 'bank',
        accountId: bank.id,
      });
      // 5000 - 2000 = 3000
      assert.equal(pos.currentBalance, '3000.00');
    });

    it('edge: olmayan hesap → TransferEndpointNotFoundError', async () => {
      await assert.rejects(
        new GetCashPositionUseCase(banks, kasas, entries, transfers).execute({
          companyId: 100,
          endpointType: 'kasa',
          accountId: 999,
        }),
        TransferEndpointNotFoundError,
      );
    });
  });

  describe('ListTransfersUseCase', () => {
    it('şirket bazlı listeler', async () => {
      const bank = await new CreateBankAccountUseCase(banks).execute({
        companyId: 100,
        bankId: 5,
        name: 'B',
        currency: 'TRY',
      });
      const kasa = await new CreateKasaAccountUseCase(kasas).execute({
        companyId: 100,
        name: 'K',
        currency: 'TRY',
      });
      await new CreateTransferUseCase(banks, kasas, transfers, clock).execute({
        companyId: 100,
        date: '2026-01-16',
        fromType: 'bank',
        fromId: bank.id,
        toType: 'kasa',
        toId: kasa.id,
        fromAmount: 100,
        toAmount: 100,
        fromCurrency: 'TRY',
        toCurrency: 'TRY',
        actorUserId: null,
      });
      const list = await new ListTransfersUseCase(transfers).execute({ companyId: 100 });
      assert.equal(list.length, 1);
      const empty = await new ListTransfersUseCase(transfers).execute({ companyId: 200 });
      assert.equal(empty.length, 0);
    });
  });
});
