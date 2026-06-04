/**
 * PayrollCalculator — Türkiye bordro hesabı (saf domain servisi).
 *
 * Brüt aylık ücret → {sgkEmployee, unemployment, incomeTax, stampTax, net}
 * kırılımını üretir. Çıktı NUMERIC(14,2) saklanacağı için 2 ondalık'a
 * yuvarlanır.
 *
 * PARİTE: frontend/src/App.jsx içindeki `calculatePayroll` + `calculateIncomeTax`
 * fonksiyonlarındaki TEK AYLIK (kümülatif olmayan) sade modeli yansıtır.
 * Legacy oranlar TR_PAYROLL_DEFAULTS_2026'dan alındı:
 *   - SGK işçi payı:        %14
 *   - İşsizlik işçi payı:   %1
 *   - Damga vergisi:        ‰7.59 (= %0.759)
 *   - Gelir vergisi dilim:  [%15, %20, %27, %35, %40]
 *   - SGK tavanı:           asgari ücret brüt × 7.5
 *
 * BİLİNÇLİ SADELEŞTİRMELER (legacy'den sapma — over-engineering'den kaçınıldı):
 *   - Kümülatif (yıl-içi artan) gelir vergisi matrahı YOK; her ay tek-aylık
 *     matrah, aylık dilimlere (yıllık/12) göre hesaplanır. Legacy kümülatif
 *     matrah tutuyordu; burada dönem bağımsızlığı için aylık dilim kullanılır.
 *   - Asgari ücret GV/DV istisnası, yemek/yol istisnaları, AR-GE teşvikleri,
 *     avans/BES gibi ek bileşenler MODELLENMEDİ. Bunlar `otherDeductions`
 *     ile use-case tarafından enjekte edilebilir (varsayılan 0).
 *   - SGK matrahı = brüt (ek SGK'lı kazanç bileşeni yok).
 * Oranlar/dilimler aşağıda adlandırılmış sabitlerde; ileride parametrik
 * yapılmak istenirse buradan ayarlanır.
 */

/** Gelir vergisi dilimi: `upTo` (yıllık üst sınır) altında `rate` (%) uygulanır. */
export interface IncomeTaxBracket {
  /** Yıllık matrah üst sınırı (TL). Üst dilim için Infinity. */
  upTo: number;
  /** Yüzde (örn. 15 = %15). */
  rate: number;
}

/** Bordro hesabında kullanılan tunable parametreler. */
export interface PayrollRates {
  /** SGK işçi payı yüzdesi. */
  sgkEmployeeRate: number;
  /** İşsizlik işçi payı yüzdesi. */
  unemploymentEmployeeRate: number;
  /** Damga vergisi yüzdesi (‰7.59 = 0.759). */
  stampDutyRate: number;
  /** Asgari ücret brüt (SGK tavanı hesabı için). */
  minimumWageGross: number;
  /** Asgari ücret × bu çarpan = SGK tavanı. */
  sgkCeilingMultiplier: number;
  /** Yıllık gelir vergisi dilimleri (artan sırada). */
  incomeTaxBrackets: ReadonlyArray<IncomeTaxBracket>;
}

/**
 * Türkiye 2026 varsayılan bordro parametreleri.
 * Kaynak: App.jsx TR_PAYROLL_DEFAULTS_2026 (legacy ile birebir).
 */
export const TR_PAYROLL_RATES_2026: PayrollRates = {
  sgkEmployeeRate: 14,
  unemploymentEmployeeRate: 1,
  stampDutyRate: 0.759,
  minimumWageGross: 26005.5,
  sgkCeilingMultiplier: 7.5,
  incomeTaxBrackets: [
    { upTo: 158000, rate: 15 },
    { upTo: 330000, rate: 20 },
    { upTo: 800000, rate: 27 },
    { upTo: 4300000, rate: 35 },
    { upTo: Infinity, rate: 40 },
  ],
};

export interface PayrollBreakdown {
  /** Brüt aylık ücret. */
  grossSalary: number;
  /** SGK işçi kesintisi. */
  sgkEmployee: number;
  /** İşsizlik işçi kesintisi. */
  unemployment: number;
  /** Gelir vergisi. */
  incomeTax: number;
  /** Damga vergisi. */
  stampTax: number;
  /** Diğer kesintiler (avans, icra, vb. — varsayılan 0). */
  otherDeductions: number;
  /** Net ücret = brüt − tüm kesintiler. */
  netSalary: number;
}

export class PayrollCalculator {
  /**
   * Brüt aylık ücretten aylık bordro kırılımını hesaplar.
   *
   * @param grossSalary Brüt aylık ücret (TL, negatif olamaz).
   * @param otherDeductions İsteğe bağlı ek kesinti (varsayılan 0).
   * @param rates Tunable parametreler (varsayılan TR 2026).
   */
  static calculate(
    grossSalary: number,
    otherDeductions = 0,
    rates: PayrollRates = TR_PAYROLL_RATES_2026,
  ): PayrollBreakdown {
    if (!Number.isFinite(grossSalary) || grossSalary < 0) {
      throw new Error('PayrollCalculator: grossSalary negatif veya geçersiz olamaz');
    }
    if (!Number.isFinite(otherDeductions) || otherDeductions < 0) {
      throw new Error('PayrollCalculator: otherDeductions negatif veya geçersiz olamaz');
    }

    // 1) SGK matrahı = brüt, tavanı uygula (asgari ücret × çarpan).
    const sgkCeiling = rates.minimumWageGross * rates.sgkCeilingMultiplier;
    const sgkBase = Math.min(grossSalary, sgkCeiling);

    // 2) SGK işçi + işsizlik işçi kesintileri.
    const sgkEmployee = round2(sgkBase * (rates.sgkEmployeeRate / 100));
    const unemployment = round2(sgkBase * (rates.unemploymentEmployeeRate / 100));

    // 3) Gelir vergisi matrahı = brüt − SGK − işsizlik (legacy ile aynı).
    const incomeTaxBase = Math.max(0, grossSalary - sgkEmployee - unemployment);

    // 4) Gelir vergisi — aylık matrahı yıllığa çevir, dilimle, 12'ye böl.
    //    (Legacy kümülatif yaklaşımın dönem-bağımsız sadeleştirmesi.)
    const annualTax = PayrollCalculator.annualIncomeTax(
      incomeTaxBase * 12,
      rates.incomeTaxBrackets,
    );
    const incomeTax = round2(annualTax / 12);

    // 5) Damga vergisi = brüt × oran.
    const stampTax = round2(grossSalary * (rates.stampDutyRate / 100));

    // 6) Net = brüt − tüm kesintiler.
    const other = round2(otherDeductions);
    const netSalary = round2(
      grossSalary - sgkEmployee - unemployment - incomeTax - stampTax - other,
    );

    return {
      grossSalary: round2(grossSalary),
      sgkEmployee,
      unemployment,
      incomeTax,
      stampTax,
      otherDeductions: other,
      netSalary,
    };
  }

  /**
   * Yıllık kümülatif matrahtan artan-dilimli gelir vergisi.
   * App.jsx `calculateIncomeTax` ile aynı dilim mantığı.
   */
  static annualIncomeTax(annualBase: number, brackets: ReadonlyArray<IncomeTaxBracket>): number {
    if (annualBase <= 0 || brackets.length === 0) return 0;
    let tax = 0;
    let lowerBound = 0;
    for (const b of brackets) {
      if (annualBase <= lowerBound) break;
      const upper = b.upTo;
      const amountInBracket = Math.min(annualBase, upper) - lowerBound;
      if (amountInBracket > 0) {
        tax += amountInBracket * (b.rate / 100);
      }
      if (annualBase <= upper) break;
      lowerBound = upper;
    }
    return tax;
  }
}

/** İki ondalık'a yuvarlar (kuruş hassasiyeti). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
