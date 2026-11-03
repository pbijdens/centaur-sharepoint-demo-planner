// Downloaden, delen en kopiëren van gegenereerde bestanden (FR-79). Niet elke omgeving ondersteunt alles
// (Teams mobiel, risico R4); de knoppen tonen alleen wat beschikbaar is.

export function download(blob: Blob, bestandsnaam: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

interface DeelNavigator {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
}

export function kanDelen(): boolean {
  const n = navigator as unknown as DeelNavigator;
  if (!n.share || !n.canShare) return false;
  try {
    return n.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'test.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export async function deel(blob: Blob, bestandsnaam: string, titel: string): Promise<void> {
  const n = navigator as unknown as DeelNavigator;
  const bestand = new File([blob], bestandsnaam, { type: blob.type });
  try {
    await (n.share as NonNullable<DeelNavigator['share']>)({ files: [bestand], title: titel });
  } catch (e) {
    // De gebruiker heeft het deelmenu gesloten; dat is geen fout.
    if ((e as { name?: string }).name !== 'AbortError') throw e;
  }
}

export function kanKopieren(): boolean {
  return !!(navigator.clipboard && (navigator.clipboard as Clipboard).write && typeof (window as unknown as { ClipboardItem?: unknown }).ClipboardItem === 'function');
}

export async function kopieer(blob: Blob): Promise<void> {
  const Item = (window as unknown as { ClipboardItem: new (items: Record<string, Blob>) => ClipboardItem }).ClipboardItem;
  await navigator.clipboard.write([new Item({ [blob.type]: blob })]);
}

/** "2026-11-02" voor in bestandsnamen. */
export function bestandsdatum(d: Date = new Date()): string {
  const p = (n: number): string => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
