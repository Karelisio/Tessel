import { describe, expect, it, vi } from 'vitest';
import {
  UpdateError,
  fetchLatestRelease,
  fetchSha256,
  parseRelease,
  parseSha256,
  pickRelease,
  releasesUrl,
  type Release,
} from './github';

const HEX = 'a'.repeat(64);
const HEX2 = '0123456789abcdef'.repeat(4);

function asset(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    size: 25_000_000,
    url: `https://api.github.com/repos/Karelisio/Tessel/releases/assets/${name}`,
    browser_download_url: `https://github.com/Karelisio/Tessel/releases/download/x/${name}`,
    ...extra,
  };
}

function raw(version: string, extra: Record<string, unknown> = {}) {
  return {
    tag_name: `v${version}`,
    name: `v${version}`,
    body: '## Nouveautés\n- un truc',
    draft: false,
    prerelease: false,
    html_url: `https://github.com/Karelisio/Tessel/releases/tag/v${version}`,
    published_at: '2026-01-01T00:00:00Z',
    assets: [asset(`tessel-v${version}.apk`), asset(`tessel-v${version}.apk.sha256`, { size: 90 })],
    ...extra,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const text = (body: string, status = 200) => new Response(body, { status });

describe('parseSha256', () => {
  it('lit « hex  nom »', () => {
    expect(parseSha256(`${HEX2}  tessel-v1.0.0.apk\n`)).toBe(HEX2);
  });
  it('lit le mode binaire « hex *nom » et les fins de ligne Windows', () => {
    expect(parseSha256(`${HEX2} *tessel-v1.0.0.apk\r\n`)).toBe(HEX2);
  });
  it("lit l'hexadécimal seul, avec espaces autour", () => {
    expect(parseSha256(`  ${HEX2}  \n\n`)).toBe(HEX2);
    expect(parseSha256(HEX2)).toBe(HEX2);
  });
  it('normalise en minuscules', () => {
    expect(parseSha256(`${HEX2.toUpperCase()}  a.apk`)).toBe(HEX2);
  });
  it('ignore un BOM', () => {
    expect(parseSha256(`${String.fromCharCode(0xfeff)}${HEX2}  a.apk`)).toBe(HEX2);
  });
  it('choisit la ligne du fichier demandé', () => {
    const body = `${HEX}  autre.apk\n${HEX2}  tessel-v1.0.0.apk\n`;
    expect(parseSha256(body, 'tessel-v1.0.0.apk')).toBe(HEX2);
  });
  it('reconnaît le nom même avec un chemin', () => {
    expect(parseSha256(`${HEX2}  build/out/tessel-v1.0.0.apk`, 'tessel-v1.0.0.apk')).toBe(HEX2);
  });
  it("refuse l'empreinte d'un autre fichier", () => {
    expect(parseSha256(`${HEX}  autre.apk`, 'tessel-v1.0.0.apk')).toBeNull();
  });
  it('accepte une empreinte seule même quand un nom est demandé', () => {
    expect(parseSha256(HEX2, 'tessel-v1.0.0.apk')).toBe(HEX2);
  });
  it.each([
    '',
    '   \n',
    'pas une empreinte',
    'abc123',
    'a'.repeat(63),
    `${'z'.repeat(64)}  a.apk`,
    '<html>404</html>',
  ])('refuse « %s »', (body) => {
    expect(parseSha256(body)).toBeNull();
  });
  it("n'accepte pas une empreinte trop longue", () => {
    expect(parseSha256('a'.repeat(65))).toBeNull();
  });
});

describe('releasesUrl', () => {
  it('vise la dernière release stable ou la liste', () => {
    expect(releasesUrl(false)).toBe('https://api.github.com/repos/Karelisio/Tessel/releases/latest');
    expect(releasesUrl(true)).toBe('https://api.github.com/repos/Karelisio/Tessel/releases?per_page=10');
  });
});

describe('parseRelease', () => {
  it('lit une release complète', () => {
    const r = parseRelease(raw('1.2.0'));
    expect(r).toMatchObject({
      tag: 'v1.2.0',
      version: '1.2.0',
      prerelease: false,
      body: '## Nouveautés\n- un truc',
    });
    expect(r?.apk).toMatchObject({ name: 'tessel-v1.2.0.apk', size: 25_000_000 });
    expect(r?.sha256File?.name).toBe('tessel-v1.2.0.apk.sha256');
  });
  it('refuse un brouillon', () => {
    expect(parseRelease(raw('1.2.0', { draft: true }))).toBeNull();
  });
  it('refuse un tag illisible', () => {
    expect(parseRelease(raw('1.2.0', { tag_name: 'nightly' }))).toBeNull();
  });
  it('refuse une release sans APK', () => {
    expect(parseRelease(raw('1.2.0', { assets: [asset('notes.txt')] }))).toBeNull();
    expect(parseRelease(raw('1.2.0', { assets: [] }))).toBeNull();
    expect(parseRelease(raw('1.2.0', { assets: undefined }))).toBeNull();
  });
  it('ignore les assets dont l’URL n’est pas en https', () => {
    const bad = asset('tessel-v1.2.0.apk', { browser_download_url: 'http://example.com/a.apk' });
    expect(parseRelease(raw('1.2.0', { assets: [bad] }))).toBeNull();
  });
  it('tolère l’absence du fichier .sha256', () => {
    const r = parseRelease(raw('1.2.0', { assets: [asset('tessel-v1.2.0.apk')] }));
    expect(r?.sha256File).toBeNull();
  });
  it('marque les pré-versions, même si GitHub ne les a pas marquées', () => {
    expect(parseRelease(raw('1.3.0-beta.1', { prerelease: true }))?.prerelease).toBe(true);
    expect(parseRelease(raw('1.3.0-beta.1'))?.prerelease).toBe(true);
  });
  it('reprend l’empreinte publiée par GitHub', () => {
    const a = asset('tessel-v1.2.0.apk', { digest: `sha256:${HEX}` });
    expect(parseRelease(raw('1.2.0', { assets: [a] }))?.apk.digest).toBe(`sha256:${HEX}`);
  });
  it('donne un repli pour la page et le nom', () => {
    const r = parseRelease(raw('1.2.0', { html_url: undefined, name: '' }));
    expect(r?.htmlUrl).toBe('https://github.com/Karelisio/Tessel/releases/tag/v1.2.0');
    expect(r?.name).toBe('Tessel 1.2.0');
  });
  it('refuse les entrées qui ne sont pas des objets', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease('v1.0.0')).toBeNull();
    expect(parseRelease([])).toBeNull();
  });
});

describe('pickRelease', () => {
  const list = [
    raw('1.3.0-beta.1', { prerelease: true }),
    raw('1.2.1'),
    raw('1.2.0'),
    raw('1.4.0', { draft: true }),
  ];

  it('prend la stable la plus récente sans les pré-versions', () => {
    expect(pickRelease(list, false)?.version).toBe('1.2.1');
  });
  it('prend la plus récente pré-versions comprises', () => {
    expect(pickRelease(list, true)?.version).toBe('1.3.0-beta.1');
  });
  it('ne prend jamais un brouillon', () => {
    expect(pickRelease([raw('9.0.0', { draft: true })], true)).toBeNull();
  });
  it('préfère la version finale à sa pré-version', () => {
    const l = [raw('2.0.0-rc.1', { prerelease: true }), raw('2.0.0')];
    expect(pickRelease(l, true)?.version).toBe('2.0.0');
  });
  it('compare les versions, pas leur position dans la liste', () => {
    expect(pickRelease([raw('1.9.0'), raw('1.10.0')], false)?.version).toBe('1.10.0');
  });
  it('accepte la réponse de /releases/latest (un objet)', () => {
    expect(pickRelease(raw('1.2.0'), false)?.version).toBe('1.2.0');
  });
  it('renvoie null pour une liste vide, du bruit ou des releases sans APK', () => {
    expect(pickRelease([], true)).toBeNull();
    expect(pickRelease({ message: 'Not Found' }, false)).toBeNull();
    expect(pickRelease('x', false)).toBeNull();
    expect(pickRelease([raw('1.0.0', { assets: [] })], false)).toBeNull();
  });
  it('passe les releases sans APK pour prendre la suivante', () => {
    expect(pickRelease([raw('1.3.0', { assets: [] }), raw('1.2.0')], false)?.version).toBe('1.2.0');
  });
});

describe('fetchLatestRelease', () => {
  it('interroge /releases/latest avec le seul en-tête Accept', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(raw('1.2.0'))));
    const release = await fetchLatestRelease(false, fetchMock);
    expect(release?.version).toBe('1.2.0');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/Karelisio/Tessel/releases/latest');
    expect(init.headers).toEqual({ Accept: 'application/vnd.github+json' });
    expect(init.credentials).toBe('omit');
    expect(init.body).toBeUndefined();
  });

  it('interroge la liste avec les pré-versions', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(json([raw('1.3.0-beta.1', { prerelease: true }), raw('1.2.0')])),
    );
    const release = await fetchLatestRelease(true, fetchMock);
    expect(release?.version).toBe('1.3.0-beta.1');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain('/releases?per_page=10');
  });

  it('renvoie null quand il n’y a encore aucune release (404)', async () => {
    const f = () => Promise.resolve(json({ message: 'Not Found' }, 404));
    expect(await fetchLatestRelease(false, f as unknown as typeof fetch)).toBeNull();
  });

  it('signale la limite de débit (403/429)', async () => {
    for (const status of [403, 429]) {
      const f = () => Promise.resolve(json({}, status));
      await expect(fetchLatestRelease(false, f as unknown as typeof fetch)).rejects.toMatchObject({
        kind: 'rateLimit',
      });
    }
  });

  it('signale une erreur serveur ou réseau', async () => {
    const f500 = () => Promise.resolve(json({}, 500));
    await expect(fetchLatestRelease(false, f500 as unknown as typeof fetch)).rejects.toMatchObject({
      kind: 'network',
    });
    const boom = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(fetchLatestRelease(false, boom as unknown as typeof fetch)).rejects.toBeInstanceOf(
      UpdateError,
    );
  });

  it('signale une réponse illisible', async () => {
    const f = () => Promise.resolve(text('<html>oups</html>'));
    await expect(fetchLatestRelease(false, f as unknown as typeof fetch)).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});

describe('fetchSha256', () => {
  const release = parseRelease(raw('1.2.0')) as Release;

  it('télécharge et lit le fichier .sha256', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(text(`${HEX2}  tessel-v1.2.0.apk\n`)));
    expect(await fetchSha256(release, fetchMock as unknown as typeof fetch)).toBe(HEX2);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(release.sha256File?.url);
  });

  it('passe par l’URL de l’API si le téléchargement direct échoue', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.startsWith('https://api.github.com') ? text(HEX2) : text('', 404)),
    );
    expect(await fetchSha256(release, fetchMock as unknown as typeof fetch)).toBe(HEX2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const init = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect(init.headers).toEqual({ Accept: 'application/octet-stream' });
  });

  it('se rabat sur l’empreinte publiée par GitHub', async () => {
    const withDigest = parseRelease(
      raw('1.2.0', { assets: [asset('tessel-v1.2.0.apk', { digest: `sha256:${HEX2.toUpperCase()}` })] }),
    ) as Release;
    const f = () => Promise.reject(new TypeError('offline'));
    expect(await fetchSha256(withDigest, f as unknown as typeof fetch)).toBe(HEX2);
  });

  it('se rabat sur l’empreinte si le fichier est illisible', async () => {
    const withDigest = parseRelease(
      raw('1.2.0', {
        assets: [asset('tessel-v1.2.0.apk', { digest: `sha256:${HEX}` }), asset('tessel-v1.2.0.apk.sha256')],
      }),
    ) as Release;
    const f = () => Promise.resolve(text('<html>pas une empreinte</html>'));
    expect(await fetchSha256(withDigest, f as unknown as typeof fetch)).toBe(HEX);
  });

  it('refuse de continuer sans aucune empreinte', async () => {
    const f = () => Promise.resolve(text('rien'));
    await expect(fetchSha256(release, f as unknown as typeof fetch)).rejects.toMatchObject({
      kind: 'noChecksum',
    });
    const bare = parseRelease(raw('1.2.0', { assets: [asset('tessel-v1.2.0.apk')] })) as Release;
    await expect(fetchSha256(bare, f as unknown as typeof fetch)).rejects.toMatchObject({
      kind: 'noChecksum',
    });
  });

  it('refuse un fichier .sha256 démesuré', async () => {
    const f = () => Promise.resolve(text(`${HEX2}  a.apk\n${'x'.repeat(10_000)}`));
    await expect(fetchSha256(release, f as unknown as typeof fetch)).rejects.toMatchObject({
      kind: 'noChecksum',
    });
  });
});
