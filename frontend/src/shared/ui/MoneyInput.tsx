/**
 * MoneyInput — Türk formatlı parasal giriş alanı.
 *
 * Kullanıcı yazarken canlı biçimlenir: binlik ayraç "." , ondalık ayraç ",".
 *   1234567.89  →  "1.234.567,89"
 *
 * Sözleşme:
 *   - `value`   : saklanan sayısal değer (number | string | null). Boş için "" / null.
 *   - `onChange`: ayrıştırılmış değer döner — geçerli giriş için `number`, boş için "".
 *
 * Native <input type="number"> binlik ayraç gösteremediği ve "," kabul etmediği için
 * type="text" + inputMode="decimal" maskeleme kullanılır. Sayı tuş takımındaki "."
 * otomatik olarak ondalık "," ya çevrilir. Odak kaybında 2 ondalığa normalize edilir.
 */
import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';

export type MoneyValue = number | string | null | undefined;

type OmittedProps = 'value' | 'onChange' | 'type' | 'step' | 'min' | 'max' | 'inputMode';

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, OmittedProps> {
  value: MoneyValue;
  /** Geçerli giriş için number, boş alan için "" döner. */
  onChange: (value: number | '') => void;
  /** Maksimum ondalık basamak (varsayılan 2). */
  decimals?: number;
  /** Binlik ayraç (.) eklensin mi (varsayılan true). Oran/kur için false. */
  grouping?: boolean;
  /** Odak kaybında değeri tam `decimals` basamağa tamamla (varsayılan true). */
  padOnBlur?: boolean;
}

/** Ham giriş string'ini Türk formatına biçimler. Trailing sıfır zorlamaz.
 *  `grouping=false` ise binlik ayraç (.) eklenmez — oran/kur alanları için. */
export function formatTRInput(raw: string, decimals = 2, grouping = true): string {
  let str = String(raw ?? '');
  const neg = /^\s*-/.test(str);
  // Ondalık ayraç olarak "." de kabul edilir: virgül yoksa ve son noktadan sonra en çok
  // `decimals` hane varsa o nokta ondalık virgüle çevrilir; öndeki noktalar (binlik grup)
  // atılır. Böylece numpad/mobil/IME/yapıştırma gibi keydown'ın yakalayamadığı yollarda
  // da ondalık girilebilir ("100405.06" → "100.405,06" yerine "10.040.506" olmaz).
  if (!str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    if (lastDot !== -1 && str.slice(lastDot + 1).replace(/\D/g, '').length <= decimals) {
      str = str.slice(0, lastDot).replace(/\./g, '') + ',' + str.slice(lastDot + 1);
    }
  }
  // Sadece rakam ve virgülü tut (grup için yazılan/önceden basılan "." atılır).
  const clean = str.replace(/[^\d,]/g, '');
  const ci = clean.indexOf(',');
  let intPart: string;
  let decPart: string | undefined;
  if (ci === -1) {
    intPart = clean;
  } else {
    intPart = clean.slice(0, ci);
    decPart = clean
      .slice(ci + 1)
      .replace(/,/g, '')
      .slice(0, decimals);
  }
  intPart = intPart.replace(/^0+(?=\d)/, ''); // baştaki gereksiz sıfırları kırp
  const grouped = grouping ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : intPart;
  let res = grouped;
  if (ci !== -1) res = (grouped === '' ? '0' : grouped) + ',' + decPart;
  if (res === '') return '';
  return (neg ? '-' : '') + res;
}

/** Türk formatlı string'i sayıya çevirir. Boş/geçersiz için "" döner. */
export function parseTRMoney(formatted: string): number | '' {
  if (formatted == null || formatted === '' || formatted === '-') return '';
  const normalized = String(formatted).replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isNaN(n) ? '' : n;
}

/** Saklanan değeri (number ya da string) görüntülenecek Türk formatına çevirir. */
function valueToDisplay(value: MoneyValue, decimals: number, grouping: boolean): string {
  if (value === '' || value === null || value === undefined) return '';
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (value.includes(',')) {
    // Türk formatlı string ("1.234,56") → "." grup, "," ondalık.
    const parsed = parseTRMoney(value);
    if (parsed === '') return '';
    n = parsed;
  } else {
    n = Number(value); // düz sayısal string ("1234.56")
  }
  if (Number.isNaN(n)) return '';
  const fixed = String(n); // örn "1234.5"
  const [ip = '', dp] = fixed.split('.');
  return formatTRInput(dp !== undefined ? `${ip},${dp}` : ip, decimals, grouping);
}

/** Biçimli string'te `sig` adet anlamlı karakterden (rakam + virgül) sonraki imleç konumu. */
function caretFromSig(formatted: string, sig: number): number {
  if (sig <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d,]/.test(formatted[i]!)) count++;
    if (count >= sig) return i + 1;
  }
  return formatted.length;
}

export function MoneyInput({
  value,
  onChange,
  decimals = 2,
  grouping = true,
  padOnBlur = true,
  ...rest
}: MoneyInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const caretRef = useRef<number | null>(null);
  const [display, setDisplay] = useState<string>(() => valueToDisplay(value, decimals, grouping));

  // Dışarıdan değer değişirse (reset, hesaplama vb.) ve alan odakta değilse senkronla.
  useEffect(() => {
    if (!focusedRef.current) setDisplay(valueToDisplay(value, decimals, grouping));
  }, [value, decimals, grouping]);

  // Biçimleme sonrası imleci, yazılan rakamın hizasında tut.
  useLayoutEffect(() => {
    if (caretRef.current != null && ref.current) {
      const pos = caretRef.current;
      ref.current.setSelectionRange(pos, pos);
      caretRef.current = null;
    }
  }, [display]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const caret = e.target.selectionStart ?? rawValue.length;
    const sigBefore = rawValue.slice(0, caret).replace(/[^\d,]/g, '').length;
    const formatted = formatTRInput(rawValue, decimals, grouping);
    caretRef.current = caretFromSig(formatted, sigBefore);
    setDisplay(formatted);
    onChange(parseTRMoney(formatted));
  };

  // Sayı tuş takımı "." → ondalık ",".
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '.') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const newRaw = el.value.slice(0, start) + ',' + el.value.slice(end);
      const formatted = formatTRInput(newRaw, decimals, grouping);
      const sigBefore = newRaw.slice(0, start + 1).replace(/[^\d,]/g, '').length;
      caretRef.current = caretFromSig(formatted, sigBefore);
      setDisplay(formatted);
      onChange(parseTRMoney(formatted));
    }
    rest.onKeyDown?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    rest.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    const parsed = parseTRMoney(display);
    if (parsed !== '') {
      // padOnBlur: tam `decimals` basamağa tamamla (1.234,5 → 1.234,50).
      // Aksi halde sadece yeniden biçimle (oran/kur: "20" → "20", "32,5" → "32,5").
      const normalized = padOnBlur
        ? formatTRInput(parsed.toFixed(decimals), decimals, grouping)
        : valueToDisplay(parsed, decimals, grouping);
      setDisplay(normalized);
    }
    rest.onBlur?.(e);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

/**
 * RateInput — oran / yüzde / döviz kuru girişi.
 * Türk ondalık ayracı (,) kullanır; binlik gruplama yapmaz ve odak kaybında
 * zorla ondalık tamamlamaz ("20" → "20" kalır, "32,5123" gibi 4 basamağa izin verir).
 */
export function RateInput({ decimals = 4, ...rest }: MoneyInputProps) {
  return <MoneyInput {...rest} decimals={decimals} grouping={false} padOnBlur={false} />;
}

export default MoneyInput;
