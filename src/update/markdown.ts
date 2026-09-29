/**
 * Mini-analyseur Markdown pour les notes de version : titres, listes, gras, italique, code, citations.
 * Produit un arbre de données (jamais de HTML) ; le rendu React échappe tout le texte.
 * Les liens et les images sont affichés en texte simple, le HTML brut reste du texte littéral.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'del'; children: Inline[] };

export interface ListItem {
  /** Niveau d'imbrication (0–2). */
  depth: number;
  children: Inline[];
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; children: Inline[] }
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; children: Inline[] }
  | { kind: 'rule' };

/** Longueur maximale prise en compte (une release GitHub peut dépasser 100 000 caractères). */
const MAX_SOURCE = 20_000;
const MAX_DEPTH = 6;

const isAlnum = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined): boolean => c === undefined || /\s/.test(c);

/** Retire les références de commit que semantic-release ajoute en fin de ligne : `([a1b2c3d](url))`. */
function stripCommitRefs(line: string): string {
  return line.replace(/\s*\(\[[0-9a-f]{7,40}\]\([^)\s]*\)\)/g, '');
}

function closing(s: string, marker: string, from: number): number {
  let i = from;
  for (;;) {
    i = s.indexOf(marker, i);
    if (i < 0) return -1;
    if (s[i - 1] === '\\') {
      i += 1;
      continue;
    }
    return i;
  }
}

/** Analyse le texte d'une ligne (ou d'un paragraphe). */
export function parseInline(source: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ kind: 'text', text: buf });
    buf = '';
  };
  const s = source;
  let i = 0;
  while (i < s.length) {
    const c = s[i] ?? '';
    // échappement d'une ponctuation
    if (c === '\\' && /[\\`*_{}[\]()#+\-.!~>|]/.test(s[i + 1] ?? '')) {
      buf += s[i + 1] ?? '';
      i += 2;
      continue;
    }
    // code
    if (c === '`') {
      let run = 1;
      while (s[i + run] === '`') run++;
      const fence = '`'.repeat(run);
      const end = s.indexOf(fence, i + run);
      if (end > i + run) {
        flush();
        out.push({ kind: 'code', text: s.slice(i + run, end).trim() });
        i = end + run;
        continue;
      }
      buf += fence;
      i += run;
      continue;
    }
    // image ou lien : seul le texte est conservé
    if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const open = c === '!' ? i + 1 : i;
      const close = closing(s, ']', open + 1);
      if (close > 0 && s[close + 1] === '(') {
        const end = s.indexOf(')', close + 2);
        if (end > 0) {
          const label = s.slice(open + 1, close);
          if (depth < MAX_DEPTH) {
            flush();
            out.push(...parseInline(label, depth + 1));
          } else buf += label;
          i = end + 1;
          continue;
        }
      }
    }
    // lien automatique <https://…>
    if (c === '<') {
      const m = /^<(https?:\/\/[^\s<>]+)>/.exec(s.slice(i));
      if (m?.[1]) {
        buf += m[1];
        i += m[0].length;
        continue;
      }
    }
    // gras / italique / barré
    const two = s.slice(i, i + 2);
    if ((two === '**' || two === '__' || two === '~~') && depth < MAX_DEPTH) {
      let end = closing(s, two, i + 2);
      // `***` : le dernier couple ferme, l'autre appartient au contenu
      while (end > 0 && s[end + 2] === two[0]) end++;
      const inner = end > 0 ? s.slice(i + 2, end) : '';
      if (end > 0 && inner.trim() !== '' && !isSpace(inner[0]) && !isSpace(inner.at(-1))) {
        if (two !== '__' || (!isAlnum(s[i - 1]) && !isAlnum(s[end + 2]))) {
          flush();
          const children = parseInline(inner, depth + 1);
          out.push({ kind: two === '~~' ? 'del' : 'strong', children });
          i = end + 2;
          continue;
        }
      }
    }
    if ((c === '*' || c === '_') && depth < MAX_DEPTH) {
      const end = closing(s, c, i + 1);
      const inner = end > 0 ? s.slice(i + 1, end) : '';
      if (end > 0 && inner !== '' && !isSpace(inner[0]) && !isSpace(inner.at(-1)) && s[i + 1] !== c) {
        if (c === '*' || (!isAlnum(s[i - 1]) && !isAlnum(s[end + 1]))) {
          flush();
          out.push({ kind: 'em', children: parseInline(inner, depth + 1) });
          i = end + 1;
          continue;
        }
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const FENCE = /^ {0,3}(```|~~~)/;
const QUOTE = /^ {0,3}>\s?(.*)$/;

const isSpecial = (line: string): boolean =>
  HEADING.test(line) || RULE.test(line) || ITEM.test(line) || FENCE.test(line) || QUOTE.test(line);

/** Analyse un document Markdown en blocs. */
export function parseMarkdown(source: string): Block[] {
  const lines = stripCommitRefs(source.slice(0, MAX_SOURCE).replace(/\r\n?/g, '\n'))
    .split('\n')
    .map((l) => stripCommitRefs(l).replace(/\t/g, '    '));
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence?.[1]) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').trimStart().startsWith(fence[1])) {
        code.push(lines[i] ?? '');
        i++;
      }
      i++; // fermeture (ou fin du texte)
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading?.[1]) {
      const level = Math.min(4, heading[1].length) as 1 | 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, children: parseInline(heading[2] ?? '') });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length) {
        const q = QUOTE.exec(lines[i] ?? '');
        if (!q) break;
        parts.push(q[1] ?? '');
        i++;
      }
      blocks.push({ kind: 'quote', children: parseInline(parts.join(' ').trim()) });
      continue;
    }
    const first = ITEM.exec(line);
    if (first) {
      const ordered = /^\d/.test(first[2] ?? '');
      const items: { depth: number; text: string }[] = [];
      const baseIndent = (first[1] ?? '').length;
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const m = ITEM.exec(cur);
        if (m && !RULE.test(cur)) {
          const indent = Math.max(0, (m[1] ?? '').length - baseIndent);
          items.push({ depth: Math.min(2, Math.floor(indent / 2)), text: m[3] ?? '' });
          i++;
        } else if (cur.trim() !== '' && /^\s+/.test(cur) && items.length > 0 && !isSpecial(cur.trim())) {
          // suite de l'élément précédent
          const last = items[items.length - 1];
          if (last) last.text += ` ${cur.trim()}`;
          i++;
        } else break;
      }
      blocks.push({
        kind: 'list',
        ordered,
        items: items.map((it) => ({ depth: it.depth, children: parseInline(it.text) })),
      });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      (para.length === 0 || !isSpecial(lines[i] ?? ''))
    ) {
      para.push((lines[i] ?? '').trim());
      i++;
    }
    blocks.push({ kind: 'paragraph', children: parseInline(para.join(' ')) });
  }
  return blocks;
}
