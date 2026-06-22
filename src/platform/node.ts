/**
 * Node platform: @napi-rs/canvas for rendering, the filesystem for assets, and
 * a hardened HTTP fetcher (SSRF / local-file protection) for user art URLs.
 */
import { createCanvas as napiCreateCanvas, loadImage as napiLoadImage, GlobalFonts } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import * as dns from 'dns';
import * as net from 'net';
import https from 'https';
import * as ipaddr from 'ipaddr.js';
import { ASSETS_DIR } from '../assets-dir';
import type { Platform, AssetData, CanvasImage, RenderCanvas } from './types';
import { mimeForFormat } from './types';
import type { RenderFormat } from '../types';

function isUnsafeIp(ip: string): boolean {
  try {
    return ipaddr.parse(ip).range() !== 'unicast';
  } catch {
    return true;
  }
}

async function resolveHostnameSafe(hostname: string): Promise<void> {
  // URL.hostname returns IPv6 addresses wrapped in brackets, e.g. "[::1]"
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (net.isIP(bare)) {
    if (isUnsafeIp(bare)) throw new Error(`Refusing to fetch unsafe IP: ${bare}`);
    return;
  }
  const addrs = await dns.promises.lookup(bare, { all: true });
  for (const a of addrs) {
    if (isUnsafeIp(a.address)) {
      throw new Error(`Hostname ${bare} resolves to unsafe IP: ${a.address}`);
    }
  }
}

/**
 * Fetch image bytes from a URL with SSRF protection.
 *
 * - `data:` URIs are always allowed.
 * - Local paths / `file://` are gated behind `allowUnsafe`.
 * - HTTP(S) hostnames are checked to not resolve to private/loopback/etc IPs
 *   unless `allowUnsafe` is set.
 */
export async function fetchBuffer(url: string, allowUnsafe = false): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma === -1) throw new Error('Invalid data URI');
    const isBase64 = url.slice(0, comma).includes(';base64');
    const data = url.slice(comma + 1);
    return Buffer.from(data, isBase64 ? 'base64' : 'utf-8');
  }
  if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('./')) {
    if (!allowUnsafe) throw new Error('Local file art URLs are disabled. Set allowUnsafeArtUrls: true to enable.');
    const filePath = url.startsWith('file://') ? new URL(url).pathname : url;
    return fs.promises.readFile(filePath);
  }
  if (!allowUnsafe) {
    const { hostname } = new URL(url);
    await resolveHostnameSafe(hostname);
  }
  const httpModule = url.startsWith('http://') ? require('http') : https;
  return new Promise<Buffer>((resolve, reject) => {
    httpModule.get(url, (res: any) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location, allowUnsafe).then(resolve, reject);
      }
      if (status < 200 || status >= 300) {
        res.resume(); // drain
        return reject(new Error(`HTTP ${status} ${res.statusMessage || ''}`.trim()));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function encodeCanvas(canvas: RenderCanvas, format: RenderFormat, quality?: number): Buffer {
  if (format === 'jpeg') return canvas.toBuffer('image/jpeg');
  if (format === 'webp') return (canvas.toBuffer as any)('image/webp', quality);
  return canvas.toBuffer('image/png');
}

export const nodePlatform: Platform = {
  createCanvas: (w, h) => napiCreateCanvas(w, h),

  loadImage: (src) => napiLoadImage(src as any),

  async loadArt(src, allowUnsafe) {
    const buf = await fetchBuffer(src, allowUnsafe);
    return napiLoadImage(buf);
  },

  async loadFont(family, relativePath) {
    GlobalFonts.registerFromPath(path.join(ASSETS_DIR, relativePath), family);
  },

  async readAsset(relativePath): Promise<AssetData> {
    return fs.promises.readFile(path.join(ASSETS_DIR, relativePath));
  },

  async encode(canvas, format, quality): Promise<Blob> {
    const buf = encodeCanvas(canvas, format, quality);
    return new Blob([buf as unknown as BlobPart], { type: mimeForFormat(format) });
  },
};

export type { CanvasImage };
