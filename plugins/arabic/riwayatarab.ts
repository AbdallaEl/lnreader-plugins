import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { defaultCover } from '@libs/defaultCover';

class RiwayatArab implements Plugin.PagePlugin {
  id = 'riwayatarab';

  name = 'RiwayatArab';

  version = '1.0.3';

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

    const novel: Plugin.SourceNovel & {
      totalPages: number;
    } = {
      path: novelUrl,
      name:
        $('h1').first().text().trim() || 'Untitled',
      cover:
        $('img').first().attr('src') ??
        defaultCover,
      author:
        $('a[href*="/author"]').first().text().trim(),
      summary:
        $('.prose').first().text().trim() ||
        $('meta[name="description"]').attr('content') ||
        '',
      status: 'Unknown',
      genres: '',
      chapters: [],
      totalPages: 1,
    };

    const genres: string[] = [];

    $('a[href*="/genre/"]').each((_, el) => {
      const text = $(el).text().trim();

      if (text.length > 0)
        genres.push(text);
    });

    novel.genres = genres.join(',');

    const chapterLinks = $(
      'a[href*="/chapter/"]',
    ).length;

    novel.totalPages =
      Math.max(1, Math.ceil(chapterLinks / 50));

    return novel;
  }

  async parsePage(
    novelPath: string,
    page: string,
  ): Promise<Plugin.SourcePage> {

    const html = await fetchApi(
      new URL(
        `${novelPath}/chapters?page=${page}`,
        this.site,
      ).toString(),
    ).then(r => r.text());

    const $ = parseHTML(html);

    const chapters: Plugin.ChapterItem[] = [];

    $('a[href*="/chapter/"]').each((_, el) => {

      const href = $(el).attr('href');

      if (!href) return;

      const title =
        $(el).text().trim();

      const number =
        Number(
          href.match(/chapter\/(\d+)/)?.[1] ?? 0,
        );

      chapters.push({
        name: title,
        path: href.replace(this.site, ''),
        chapterNumber: number,
      });

    });

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

    let content = '';

    const containers = [
      '.chapter-content',
      '.prose',
      'article',
      'main article',
      '[class*="chapter"]',
    ];

    for (const selector of containers) {
      const node = $(selector).first();

      if (node.length) {
        content = node.html() ?? '';
        break;
      }
    }

    if (!content) {
      $('p').each((_, el) => {
        content += `<p>${$(el).html() ?? ''}</p>`;
      });
    }

    return content.trim();
  }

  filters = {};
}

export default new RiwayatArab();