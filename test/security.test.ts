import { describe, it, expect } from 'vitest';
import { fetchBuffer } from '../src/platform/node';

describe('fetchBuffer security', () => {
  describe('with allowUnsafe=false (default)', () => {
    it('rejects local file paths', async () => {
      await expect(fetchBuffer('/etc/passwd')).rejects.toThrow(/Local file art URLs are disabled/);
    });

    it('rejects relative file paths', async () => {
      await expect(fetchBuffer('./secret.txt')).rejects.toThrow(/Local file art URLs are disabled/);
    });

    it('rejects file:// URIs', async () => {
      await expect(fetchBuffer('file:///etc/passwd')).rejects.toThrow(/Local file art URLs are disabled/);
    });

    it('rejects loopback IP', async () => {
      await expect(fetchBuffer('http://127.0.0.1/foo')).rejects.toThrow(/unsafe IP/);
    });

    it('rejects private IP (10.x)', async () => {
      await expect(fetchBuffer('http://10.0.0.1/foo')).rejects.toThrow(/unsafe IP/);
    });

    it('rejects private IP (192.168.x)', async () => {
      await expect(fetchBuffer('http://192.168.1.1/foo')).rejects.toThrow(/unsafe IP/);
    });

    it('rejects link-local IP (cloud metadata)', async () => {
      await expect(fetchBuffer('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/unsafe IP/);
    });

    it('rejects IPv6 loopback', async () => {
      await expect(fetchBuffer('http://[::1]/foo')).rejects.toThrow(/unsafe IP/);
    });

    it('rejects hostnames that resolve to loopback', async () => {
      // localhost resolves to 127.0.0.1 (and/or ::1)
      await expect(fetchBuffer('http://localhost/foo')).rejects.toThrow(/unsafe IP/);
    });

    it('allows data URIs', async () => {
      // 1x1 transparent PNG
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
      const buf = await fetchBuffer(dataUri);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  describe('with allowUnsafe=true', () => {
    it('allows file:// URIs', async () => {
      // Read this test file itself
      const buf = await fetchBuffer(`file://${__filename}`, true);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('utf-8')).toContain('fetchBuffer security');
    });

    it('allows absolute file paths', async () => {
      const buf = await fetchBuffer(__filename, true);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('utf-8')).toContain('fetchBuffer security');
    });
  });
});
