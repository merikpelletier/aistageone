export function requiredPositive(value: unknown, label: string): number {
  const n = Number(value);
  if (value == null || value === '' || !Number.isFinite(n) || n <= 0) throw new Error(label);
  return n;
}

export function creditQuote(costUsd: number, fx: number, creditValue: number, minimum = 1) {
  const cost = requiredPositive(costUsd, 'Coût fournisseur manquant');
  const rate = requiredPositive(fx, 'Taux USD/CAD manquant');
  const value = requiredPositive(creditValue, 'Valeur nette CAD du crédit manquante');
  const raw = cost * rate / 0.6 / value;
  if (!Number.isFinite(raw) || raw > 1e9) throw new Error('Prix hors limites');
  let credits = Math.max(Math.ceil(raw), Math.ceil(minimum), 1);
  if (credits * value * 0.6 < cost * rate) credits++;
  return { credits, cost_cad: cost * rate, estimated_revenue_cad: credits * value };
}

export type ModelRate = {
  model_key: string; billing_type: string; unit_price_usd: number;
  output_unit_price_usd?: number; max_runtime_seconds?: number;
  source_url: string; quote_enabled: boolean;
};
export type CostLine = {
  model_key: string; count?: number; characters?: number; output_seconds?: number;
  input_tokens?: number; output_tokens?: number; options?: Record<string, unknown>;
};

export function lineCost(line: CostLine, rate: ModelRate, quoting = true) {
  if (!rate || (quoting && !rate.quote_enabled)) throw new Error(`Tarif à valider : ${line.model_key}`);
  const unit = requiredPositive(rate.unit_price_usd, 'Tarif fournisseur manquant');
  const count = line.count ?? 1;
  let cost: number;
  switch (rate.billing_type) {
    case 'prediction': cost = unit; break;
    case 'characters': cost = requiredPositive(line.characters, 'Nombre de caractères inconnu') * unit / 1000; break;
    case 'output_seconds': cost = requiredPositive(line.output_seconds, 'Durée fournisseur non vérifiée') * unit; break;
    case 'runtime_seconds': cost = requiredPositive(rate.max_runtime_seconds, 'Temps maximal manquant') * unit; break;
    case 'tokens': {
      const outRate = rate.output_unit_price_usd;
      if (outRate == null || !Number.isFinite(Number(outRate)) || Number(outRate) < 0) throw new Error('Tarif de sortie manquant');
      cost = (requiredPositive(line.input_tokens, 'Entrée texte non bornée') * unit + requiredPositive(line.output_tokens, 'Sortie texte non bornée') * Number(outRate)) / 1000;
      break;
    }
    default: throw new Error('Unité de facturation non prise en charge');
  }
  return requiredPositive(cost * count, 'Coût non calculable');
}

export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mois invalide');
  const start = `${month}-01T00:00:00.000Z`;
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end: end.toISOString() };
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export async function payloadHash(name: string, payload: unknown) {
  const bytes = new TextEncoder().encode(canonical({ name, payload }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
