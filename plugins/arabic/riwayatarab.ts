import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { defaultCover } from '@libs/defaultCover';

class RiwayatArab implements Plugin.PluginBase {
  id = 'riwayatarab';

  name = 'RiwayatArab';

  version = '1.0.7';

  icon = 'src/ar/riwayatarab/icon.png';

  site = 'https://riwayatarab.com/';

  async popularNovels(
    page: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}?page=${page}`;

    const html = await fetchApi(url).then(r => r.text());

    const $ = parseHTML(html);

    const novels: Plugin.NovelItem[] = [];
    const added = new Set<string>();

    $('a[href*="/novel/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || added.has(href)) return;
      added.add(href);

      const title =
  $(el).find('h3, h2, .title').first().text().trim() ||
  $(el).text().trim() ||
  $(el).attr('title') ||
  'Novel';

      const cover =
        $(el).find('img').attr('src') ??
        defaultCover;

      novels.push({
        name: title,
        path: href.replace(this.site, '').replace(/^\/+/, ''),
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
    const added = new Set<string>();

    $('a[href*="/novel/"]').each((_, el) => {

      const href = $(el).attr('href');

      if (!href || added.has(href)) return;
      added.add(href);

      novels.push({
        name:
          $(el).find('h3').text().trim() ||
          $(el).attr('title') ||
          'Novel',

        path: new URL(href, this.site).pathname.replace(/^\/+/, ''),
        cover:
          $(el).find('img').attr('src') ??
          defaultCover,
      });

    });

    return novels;
  }

  async parseNovel(
    novelUrl: string,
  ): Promise<Plugin.SourceNovel> {

    const fullUrl = new URL(novelUrl, this.site).toString();

    const html = await fetchApi(fullUrl).then(r => r.text());

    const $ = parseHTML(html);

    const novel: Plugin.SourceNovel = {
      path: novelUrl,
      name: $('h1').first().text().trim() || 'Untitled',
      cover: defaultCover,
      author: '',
      summary: '',
      status: 'Unknown',
      genres: '',
      chapters: [],
    };

    // الغلاف: أول صورة بعد h1، أو أول img عمومًا كحل احتياطي
    const cover = $('img').first().attr('src');
    if (cover) novel.cover = cover;

    // الحالة (مستمرة / مكتملة)
    if (html.includes('مكتملة')) {
      novel.status = 'Completed';
    } else if (html.includes('مستمرة') || html.includes('متوقفة')) {
      novel.status = html.includes('متوقفة') ? 'On Hiatus' : 'Ongoing';
    }

    // التصنيف (لينكات ?category=)
    const genres: string[] = [];
    $('a[href*="?category="]').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });
    novel.genres = genres.join(',');

    // الوصف: القسم اللي بعد عنوان "نبذة عن الرواية"
    const summaryHeading = $('h2, h3').filter(
      (_, el) => $(el).text().includes('نبذة'),
    ).first();
    if (summaryHeading.length) {
      novel.summary = summaryHeading.next().text().trim();
    }
    if (!novel.summary) {
      // احتياطي: أطول فقرة نصية في الصفحة
      let longest = '';
      $('p').each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > longest.length) longest = t;
      });
      novel.summary = longest;
    }

    // عدد الفصول من نص الصفحة (مثال: "442 فصل")
    const totalMatch = html.match(/(\d+)\s*فصل/);
    const totalChapters = totalMatch ? Number(totalMatch[1]) : 0;

    const chapters: Plugin.ChapterItem[] = [];

    if (totalChapters > 0) {
      // الأرقام متسلسلة من 1 إلى العدد الكلي — نولّدها مباشرة
      const base = novelUrl.replace(/\/$/, '');
      for (let i = 1; i <= totalChapters; i++) {
        chapters.push({
          name: `الفصل ${i}`,
          path: `${base}/chapter/${i}`,
          chapterNumber: i,
        });
      }
    } else {
      // احتياطي: لو مش لاقيين رقم إجمالي، نستخرج الفصول الظاهرة في الصفحة نفسها
      const added = new Set<string>();
      $('a[href*="/chapter/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || added.has(href)) return;
        added.add(href);

        const number = Number(href.match(/chapter\/(\d+)/)?.[1] ?? 0);

        chapters.push({
          name: $(el).text().trim() || `Chapter ${number}`,
          path: href.replace(this.site, '').replace(/^\/+/, ''),
          chapterNumber: number,
        });
      });
      chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    novel.chapters = chapters;

    return novel;
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
