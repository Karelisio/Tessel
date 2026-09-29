import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, type Inline } from './markdown';

const text = (t: string): Inline => ({ kind: 'text', text: t });

describe('parseInline', () => {
  it('garde le texte simple', () => {
    expect(parseInline('bonjour le monde')).toEqual([text('bonjour le monde')]);
    expect(parseInline('')).toEqual([]);
  });
  it('lit gras, italique et barré', () => {
    expect(parseInline('un **gras** et *italique* et ~~barré~~')).toEqual([
      text('un '),
      { kind: 'strong', children: [text('gras')] },
      text(' et '),
      { kind: 'em', children: [text('italique')] },
      text(' et '),
      { kind: 'del', children: [text('barré')] },
    ]);
    expect(parseInline('__gras__ et _italique_')).toEqual([
      { kind: 'strong', children: [text('gras')] },
      text(' et '),
      { kind: 'em', children: [text('italique')] },
    ]);
  });
  it('imbrique italique dans gras', () => {
    expect(parseInline('**très *doux***')).toEqual([
      { kind: 'strong', children: [text('très '), { kind: 'em', children: [text('doux')] }] },
    ]);
  });
  it('lit le code sans interpréter son contenu', () => {
    expect(parseInline('la `**clé**` ici')).toEqual([
      text('la '),
      { kind: 'code', text: '**clé**' },
      text(' ici'),
    ]);
  });
  it('affiche les liens et images en texte', () => {
    expect(parseInline('voir [la page](https://exemple.fr/x) ok')).toEqual([
      text('voir '),
      text('la page'),
      text(' ok'),
    ]);
    expect(parseInline('![logo](https://exemple.fr/l.png)')).toEqual([text('logo')]);
    expect(parseInline('<https://exemple.fr>')).toEqual([text('https://exemple.fr')]);
  });
  it('ne fabrique jamais de lien javascript:', () => {
    const out = parseInline('[clic](javascript:alert(1))');
    expect(JSON.stringify(out)).not.toContain('href');
    expect(out.every((n) => n.kind === 'text')).toBe(true);
  });
  it('laisse le HTML brut comme texte littéral', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([text('<img src=x onerror=alert(1)>')]);
    expect(parseInline('<script>x</script>')).toEqual([text('<script>x</script>')]);
  });
  it("n'italicise pas les mots avec tiret bas ni les astérisques isolés", () => {
    expect(parseInline('snake_case_name')).toEqual([text('snake_case_name')]);
    expect(parseInline('2 * 3 * 4')).toEqual([text('2 * 3 * 4')]);
    expect(parseInline('a ** b')).toEqual([text('a ** b')]);
  });
  it('gère les marqueurs non fermés et les échappements', () => {
    expect(parseInline('**ouvert')).toEqual([text('**ouvert')]);
    expect(parseInline('`ouvert')).toEqual([text('`ouvert')]);
    expect(parseInline('[sans lien]')).toEqual([text('[sans lien]')]);
    expect(parseInline('\\*pas italique\\*')).toEqual([text('*pas italique*')]);
  });
  it('résiste à une imbrication excessive', () => {
    const deep = '*a '.repeat(50);
    expect(() => parseInline(deep)).not.toThrow();
    expect(() => parseInline('['.repeat(2000))).not.toThrow();
  });
});

describe('parseMarkdown', () => {
  it('lit des titres de niveau 1 à 4 (au-delà : 4)', () => {
    const b = parseMarkdown('# A\n## B\n### C\n###### D');
    expect(b.map((x) => (x.kind === 'heading' ? x.level : 0))).toEqual([1, 2, 3, 4]);
  });
  it('lit une liste à puces et une liste numérotée', () => {
    const b = parseMarkdown('- un\n- deux\n\n1. premier\n2. second');
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ kind: 'list', ordered: false });
    expect(b[1]).toMatchObject({ kind: 'list', ordered: true });
    expect(b[0]?.kind === 'list' && b[0].items).toHaveLength(2);
  });
  it('accepte les marqueurs *, - et + et l’imbrication', () => {
    const b = parseMarkdown('* a\n  * b\n    * c\n+ d');
    const list = b[0];
    expect(list?.kind === 'list' && list.items.map((i) => i.depth)).toEqual([0, 1, 2, 0]);
  });
  it('recolle les lignes de continuation d’un élément', () => {
    const b = parseMarkdown('- une phrase\n  qui continue');
    expect(b[0]?.kind === 'list' && b[0].items[0]?.children).toEqual([text('une phrase qui continue')]);
  });
  it('joint les lignes d’un paragraphe et sépare sur ligne vide', () => {
    const b = parseMarkdown('ligne un\nligne deux\n\nautre');
    expect(b).toHaveLength(2);
    expect(b[0]).toEqual({ kind: 'paragraph', children: [text('ligne un ligne deux')] });
  });
  it('lit les blocs de code, y compris non fermés', () => {
    expect(parseMarkdown('```\na *b*\n  c\n```\nsuite')).toEqual([
      { kind: 'code', text: 'a *b*\n  c' },
      { kind: 'paragraph', children: [text('suite')] },
    ]);
    expect(parseMarkdown('```ts\nx')).toEqual([{ kind: 'code', text: 'x' }]);
  });
  it('lit citations et séparateurs', () => {
    expect(parseMarkdown('> une\n> citation\n\n---')).toEqual([
      { kind: 'quote', children: [text('une citation')] },
      { kind: 'rule' },
    ]);
  });
  it('supprime les références de commit de semantic-release', () => {
    const b = parseMarkdown(
      '* **jeu:** corrige le zoom ([a1b2c3d](https://github.com/Karelisio/Tessel/commit/a1b2c3d4))',
    );
    const item = b[0]?.kind === 'list' ? b[0].items[0] : undefined;
    expect(item?.children).toEqual([{ kind: 'strong', children: [text('jeu:')] }, text(' corrige le zoom')]);
  });
  it('garde les références de ticket', () => {
    const b = parseMarkdown('- réglé ([#12](https://github.com/Karelisio/Tessel/issues/12))');
    expect(b[0]?.kind === 'list' && b[0].items[0]?.children).toEqual([
      text('réglé ('),
      text('#12'),
      text(')'),
    ]);
  });
  it('gère les fins de ligne Windows, le vide et les entrées énormes', () => {
    expect(parseMarkdown('# A\r\n\r\n- b\r\n')).toHaveLength(2);
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('   \n\n')).toEqual([]);
    const huge = parseMarkdown('- x\n'.repeat(100_000));
    expect(huge[0]?.kind === 'list' && huge[0].items.length).toBeLessThanOrEqual(10_000);
  });
  it('rend une release réaliste', () => {
    const md = [
      '# [1.2.0](https://github.com/Karelisio/Tessel/compare/v1.1.0...v1.2.0) (2026-03-01)',
      '',
      '### Nouveautés',
      '',
      '* **galerie:** cadres animés ([1234567](https://github.com/x/y/commit/1234567))',
      '',
      '### Corrections',
      '',
      '* le zoom au double tap ([abcdef0](https://github.com/x/y/commit/abcdef0))',
    ].join('\n');
    const b = parseMarkdown(md);
    expect(b.map((x) => x.kind)).toEqual(['heading', 'heading', 'list', 'heading', 'list']);
  });
});
