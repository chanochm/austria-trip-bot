import { readFileSync } from 'node:fs';

function prettify(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Loads the kosher supervision list JSON and flattens its deliberately
 * heterogeneous structure (brand+products, medications, rules, wine lists,
 * establishments, not_kosher lists, E-numbers, ...) into a flat array of
 * searchable records. The source document mixes many different shapes per
 * category, so this walker pattern-matches on shape rather than modeling
 * every category's exact schema.
 */
export class KosherData {
  constructor(filePath) {
    this.raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    this.records = [];
    this._index();
  }

  get meta() {
    return this.raw.meta;
  }

  _push(record) {
    this.records.push(record);
  }

  _walk(node, ctx) {
    if (node == null) return;

    if (Array.isArray(node)) {
      const allStrings = node.length > 0 && node.every((x) => typeof x === 'string');
      if (allStrings) {
        for (const s of node) {
          this._push({
            type: ctx.statusOverride ? 'flagged_product' : 'product',
            categoryPath: ctx.categoryPath,
            brand: ctx.brand,
            product: s,
            certification_required: ctx.certification,
            origin_required: ctx.origin,
            status: ctx.statusOverride,
            note: ctx.note,
          });
        }
        return;
      }
      for (const item of node) this._walk(item, ctx);
      return;
    }

    if (typeof node !== 'object') return;

    // medication-shaped record: { product, status, status_meaning }
    if (typeof node.product === 'string' && typeof node.status === 'string' && 'status_meaning' in node) {
      this._push({
        type: 'medication',
        categoryPath: ctx.categoryPath,
        product: node.product,
        status: node.status,
        note: node.status_meaning,
      });
      return;
    }

    // establishment-shaped record: { name, address, ... }
    if (typeof node.name === 'string' && typeof node.address === 'string') {
      this._push({
        type: 'establishment',
        categoryPath: ctx.categoryPath,
        name: node.name,
        kind: node.type,
        address: node.address,
        phone: node.phone,
      });
      return;
    }

    // rule-in-list shape: { type, status, note } (e.g. beer flavored/unflavored)
    if (typeof node.type === 'string' && typeof node.status === 'string') {
      this._push({
        type: 'rule',
        categoryPath: ctx.categoryPath,
        subject: node.type,
        status: node.status,
        note: node.note,
      });
      return;
    }

    // brand-with-products shape
    if (typeof node.brand === 'string' && (Array.isArray(node.products) || Array.isArray(node.products_removed))) {
      const nextCtx = {
        ...ctx,
        brand: node.brand,
        certification: node.certification_required ?? ctx.certification,
        origin: node.origin_required ?? ctx.origin,
        note: node.note,
      };
      if (node.products) this._walk(node.products, nextCtx);
      if (node.products_removed) {
        this._walk(node.products_removed, { ...nextCtx, statusOverride: 'removed_from_list' });
      }
      return;
    }

    // plain object with its own products array but no "brand" field
    // (e.g. fleisch_hager: { phone, address, products: [...] })
    if (Array.isArray(node.products) && typeof node.brand !== 'string') {
      this._walk(node.products, { ...ctx });
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'products' || key === 'products_removed') continue; // handled above
      if (key === 'not_kosher' && Array.isArray(value)) {
        this._walk(value, { ...ctx, statusOverride: 'Nicht Koscher' });
        continue;
      }
      if (key === 'kosher_fish_names' && Array.isArray(value)) {
        for (const f of value) this._push({ type: 'kosher_fish', name: f });
        continue;
      }
      if (key === 'e_numbers' && Array.isArray(value)) {
        for (const e of value) this._push({ type: 'non_kosher_e_number', code: e });
        continue;
      }
      if (key === 'forbidden_label_terms' && Array.isArray(value)) {
        for (const t of value) this._push({ type: 'forbidden_label_term', categoryPath: ctx.categoryPath, term: t });
        continue;
      }
      if (key === 'rule' && typeof value === 'string') {
        this._push({ type: 'category_rule', categoryPath: ctx.categoryPath, rule: value });
        continue;
      }
      if (value && typeof value === 'object') {
        let nextCategoryPath = ctx.categoryPath;
        let nextBrand = ctx.brand;
        const label = value.name_de || value.name;
        const isStructuralKey = key === 'subsections' || key === 'entries' || key === 'brands' || !isNaN(Number(key));
        if (label) {
          nextCategoryPath = ctx.categoryPath ? `${ctx.categoryPath} > ${label}` : label;
        } else if (!Array.isArray(value) && !isStructuralKey) {
          // producer-style top-level key acting as an implicit brand/section name
          nextBrand = prettify(key);
          nextCategoryPath = ctx.categoryPath ? `${ctx.categoryPath} > ${prettify(key)}` : prettify(key);
        }
        this._walk(value, { ...ctx, categoryPath: nextCategoryPath, brand: nextBrand });
      }
    }
  }

  _index() {
    const categories = this.raw.categories || {};
    for (const [id, cat] of Object.entries(categories)) {
      const label = [cat.name_de, cat.name_en].filter(Boolean).join(' / ') || `Category ${id}`;
      this._walk(cat, { categoryPath: label });
    }
    const producers = this.raw.supervised_producers_and_establishments || {};
    this._walk(producers, { categoryPath: 'Supervised Producers & Establishments' });
  }

  search(query, limit = 15) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Two-tier ranking: a match on the record's own identifying fields
    // (product/brand/name/term/code) ranks above a match that only shows up
    // incidentally inside a "note" or "categoryPath" string — otherwise a
    // brand-level warning note (e.g. "NICHT KOSCHER: flavor X, flavor Y...")
    // that gets copied onto every sibling product can bury the one record
    // that's actually about the flavor being searched for.
    const primary = [];
    const secondary = [];
    for (const r of this.records) {
      const primaryFields = [r.product, r.brand, r.name, r.term, r.code]
        .filter((v) => typeof v === 'string')
        .join(' | ')
        .toLowerCase();
      if (primaryFields.includes(q)) {
        primary.push(r);
        continue;
      }
      const allFields = Object.values(r)
        .filter((v) => typeof v === 'string')
        .join(' | ')
        .toLowerCase();
      if (allFields.includes(q)) {
        secondary.push(r);
      }
    }
    const results = [...primary, ...secondary].slice(0, limit);
    return results;
  }
}
