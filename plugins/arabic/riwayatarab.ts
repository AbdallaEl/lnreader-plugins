import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { defaultCover } from '@libs/defaultCover';

class RiwayatArab implements Plugin.PagePlugin {
  id = 'riwayatarab';

  name = 'RiwayatArab';

  version = '1.0.4';

  icon = 'src/ar/riwayatarab/icon.png';

  site = 'https://riwayatarab.com/';

  async popularNovels(
    page: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}?page=${page}`;

    const html = await fetchApi(url).then(r => r.text());

    const $ = parseHTML(html);

    const novels: Plugin.NovelItem[] = [];

    $('a[href*="/novel/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const title =
        $(el).find('h3').text().trim() ||
        $(el).attr('title') ||
        'Novel';

      const cover =
        $(el).find('img').attr('src') ??
        defaultCover;

      novels.push({
        name: title,
        path: href.replace(this.site, ''),
        cover,
      });
    });

    return novels;
  }

  async searchNovels(
    searchTerm: string,
  ): Promise<Plugin.NovelItem[]> {

    const url =
      `${this.site}search?q=${encodeURIComponent(searchTerm)}`;

    const html =
      await fetchApi(url).then(r => r.text());

    const $ = parseHTML(html);

    const novels: Plugin.NovelItem[] = [];

    $('a[href*="/novel/"]').each((_, el) => {

      const href = $(el).attr('href');

      if (!href) return;

      novels.push({
        name:
          $(el).find('h3').text().trim() ||
          $(el).attr('title') ||
          'Novel',

        path: href.replace(this.site, ''),

        cover:
          $(el).find('img').attr('src') ??
          defaultCover,
      });

    });

    return novels;
  }
  async parseNovel(
  novelUrl: string,
): Promise<Plugin.SourceNovel & { totalPages: number }> {

  const html = await fetchApi(
    new URL(novelUrl, this.site).toString(),
  ).then(r => r.text());

  const $ = parseHTML(html);

  const script = html.match(/self\.__next_f\.push\((.*?)\);/gs);

  const novel: Plugin.SourceNovel & {
    totalPages: number;
  } = {
    path: novelUrl,
    name: $('h1').first().text().trim() || 'Untitled',
    cover: defaultCover,
    author: '',
    summary: '',
    status: 'Unknown',
    genres: '',
    chapters: [],
    totalPages: 1,
  };

  if (script) {
    const text = script.join("\n");

    const cover = text.match(/https?:\/\/[^"]+\.(jpg|jpeg|png|webp)/i);
    if (cover) novel.cover = cover[0];

    const summary = text.match(/description["']?:["']([^"]+)/i);
    if (summary) novel.summary = summary[1];

    const author = text.match(/author["']?:["']([^"]+)/i);
    if (author) novel.author = author[1];
  }

  return novel;
}

  async parsePage(
  novelPath: string,
  page: string,
): Promise<Plugin.SourcePage> {

  const html = await fetchApi(
    new URL(novelPath, this.site).toString(),
  ).then(r => r.text());

  const $ = parseHTML(html);

  const chapters: Plugin.ChapterItem[] = [];

  const added = new Set<string>();

  $('a[href*="/chapter/"]').each((_, el) => {

    const href = $(el).attr('href');
    if (!href || added.has(href)) return;

    added.add(href);

    const number = Number(
      href.match(/chapter\/(\d+)/)?.[1] ?? 0,
    );

    chapters.push({
      name: $(el).text().trim() || `Chapter ${number}`,
      path: href.replace(this.site, ''),
      chapterNumber: number,
    });

  });

  chapters.sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );

  return {
    chapters,
  };
}
  async parseChapter(
  chapterUrl: string,
): Promise<string> {

  const html = await fetchApi(
    new URL(chapterUrl, this.site).toString(),
  ).then(r => r.text());

  const $ = parseHTML(html);

  const selectors = [
    'article',
    'main article',
    '.prose',
    '.chapter-content',
    '[class*="chapter"]',
    '[class*="content"]',
  ];

  for (const selector of selectors) {
    const node = $(selector).first();

    if (node.length && node.text().trim().length > 100) {
      return node.html() ?? '';
    }
  }

  let content = '';

  $('p').each((_, el) => {
    const text = $(el).html();

    if (text && text.trim().length > 0) {
      content += `<p>${text}</p>`;
    }
  });

  return content.trim();
}

  filters = {};
}

export default new RiwayatArab();