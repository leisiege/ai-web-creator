/**
 * 网页抓取工具
 * 解析 HTML 并提取结构化内容
 */
import { AgentTool } from './base.js';
import type { ToolParameter, ToolContext, ToolCallResult } from '../../utils/types.js';
import { withRetry } from '../../utils/retry.js';
import * as cheerio from 'cheerio';

interface ScraperOptions {
  url: string;
  selector?: string;
  extractText?: boolean;
  extractLinks?: boolean;
  extractImages?: boolean;
  extractMetadata?: boolean;
  maxContentLength?: number;
  timeout?: number;
}

interface ScraperResult {
  url: string;
  title?: string;
  metadata?: Record<string, string>;
  content?: {
    text?: string;
    links?: Array<{ text: string; href: string }>;
    images?: Array<{ src: string; alt?: string }>;
    selectedElements?: string[];
  };
  stats: {
    contentLength: number;
    elementsExtracted: number;
  };
}

export class WebScraperTool extends AgentTool {
  getName(): string {
    return 'web_scraper';
  }

  getDescription(): string {
    return 'Extract structured content from web pages. Can extract text, links, images, metadata, and specific CSS selectors.';
  }

  getParameters(): ToolParameter[] {
    return [
      {
        name: 'url',
        type: 'string',
        description: 'The URL of the web page to scrape',
        required: true
      },
      {
        name: 'selector',
        type: 'string',
        description: 'CSS selector to extract specific elements (optional)',
        required: false
      },
      {
        name: 'extractText',
        type: 'boolean',
        description: 'Extract the main text content of the page',
        required: false,
        default: true
      },
      {
        name: 'extractLinks',
        type: 'boolean',
        description: 'Extract all links from the page',
        required: false,
        default: false
      },
      {
        name: 'extractImages',
        type: 'boolean',
        description: 'Extract all images from the page',
        required: false,
        default: false
      },
      {
        name: 'extractMetadata',
        type: 'boolean',
        description: 'Extract page metadata (title, description, og tags, etc.)',
        required: false,
        default: true
      },
      {
        name: 'maxContentLength',
        type: 'number',
        description: 'Maximum content length in characters',
        required: false,
        default: 500000
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds',
        required: false,
        default: 30000
      }
    ];
  }

  async execute(params: Record<string, unknown>, _context?: ToolContext): Promise<ToolCallResult> {
    const options: ScraperOptions = {
      url: String(params.url),
      selector: params.selector as string | undefined,
      extractText: params.extractText as boolean ?? true,
      extractLinks: params.extractLinks as boolean ?? false,
      extractImages: params.extractImages as boolean ?? false,
      extractMetadata: params.extractMetadata as boolean ?? true,
      maxContentLength: (params.maxContentLength as number) || 500000,
      timeout: (params.timeout as number) || 30000
    };

    try {
      const result = await withRetry(
        () => this.scrape(options),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        }
      );

      return {
        success: true,
        data: result,
        metadata: {
          url: options.url,
          extractionTime: result.stats.contentLength + ' chars'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async scrape(options: ScraperOptions): Promise<ScraperResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(options.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AiWebCreator/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      if (html.length > options.maxContentLength!) {
        throw new Error(`Content too large: ${html.length} chars exceeds limit of ${options.maxContentLength}`);
      }

      const $ = cheerio.load(html);
      const result: ScraperResult = {
        url: options.url,
        stats: {
          contentLength: html.length,
          elementsExtracted: 0
        }
      };

      // 提取元数据
      if (options.extractMetadata) {
        result.metadata = this.extractMetadata($);
        result.title = $('title').text() || '';
      }

      result.content = {};

      // 使用选择器提取特定元素
      if (options.selector) {
        const elements: string[] = [];
        $(options.selector).each((_, el) => {
          elements.push($(el).text().trim());
        });
        result.content.selectedElements = elements;
        result.stats.elementsExtracted += elements.length;
      }

      // 提取文本内容
      if (options.extractText) {
        // 移除脚本和样式
        $('script, style').remove();
        const text = $('body').text()
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 10000); // 限制文本长度
        result.content.text = text;
      }

      // 提取链接
      if (options.extractLinks) {
        const links: Array<{ text: string; href: string }> = [];
        $('a[href]').each((_, el) => {
          const $el = $(el);
          links.push({
            text: $el.text().trim(),
            href: $el.attr('href') || ''
          });
        });
        result.content.links = links;
        result.stats.elementsExtracted += links.length;
      }

      // 提取图片
      if (options.extractImages) {
        const images: Array<{ src: string; alt?: string }> = [];
        $('img[src]').each((_, el) => {
          const $el = $(el);
          images.push({
            src: $el.attr('src') || '',
            alt: $el.attr('alt')
          });
        });
        result.content.images = images;
        result.stats.elementsExtracted += images.length;
      }

      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractMetadata($: cheerio.CheerioAPI): Record<string, string> {
    const metadata: Record<string, string> = {};

    // 基本 meta 标签
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      if (name && content) {
        metadata[name] = content;
      }
    });

    // 特殊 meta 标签
    const description = $('meta[name="description"]').attr('content');
    if (description) metadata.description = description;

    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) metadata.ogTitle = ogTitle;

    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) metadata.ogImage = ogImage;

    return metadata;
  }
}
