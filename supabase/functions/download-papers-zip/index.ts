import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

const STORAGE_BUCKET = 'manpower-docs';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ZipFile = {
  path: string;
  zipName: string;
};

type CentralEntry = {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

const encoder = new TextEncoder();

const sanitizeZipName = (name: string) =>
  String(name || 'file.pdf')
    .replace(/[\\:*?"<>|]/g, '_')
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => part.trim().slice(0, 120) || 'Unknown')
    .join('/')
    .slice(0, 360) || 'file.pdf';

const u16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const u32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

const makeCrcTable = () => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
};

const CRC_TABLE = makeCrcTable();

const crc32Update = (crc: number, chunk: Uint8Array) => {
  let c = crc;
  for (let i = 0; i < chunk.length; i += 1) c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  return c >>> 0;
};

const dosDateTime = () => {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
};

const localHeader = (nameBytes: Uint8Array, time: number, date: number) => {
  const out = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(out.buffer);
  u32(view, 0, 0x04034b50);
  u16(view, 4, 20);
  u16(view, 6, 0x0808);
  u16(view, 8, 0);
  u16(view, 10, time);
  u16(view, 12, date);
  u16(view, 26, nameBytes.length);
  out.set(nameBytes, 30);
  return out;
};

const dataDescriptor = (crc: number, size: number) => {
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  u32(view, 0, 0x08074b50);
  u32(view, 4, crc);
  u32(view, 8, size);
  u32(view, 12, size);
  return out;
};

const centralHeader = (entry: CentralEntry) => {
  const out = new Uint8Array(46 + entry.nameBytes.length);
  const view = new DataView(out.buffer);
  u32(view, 0, 0x02014b50);
  u16(view, 4, 20);
  u16(view, 6, 20);
  u16(view, 8, 0x0808);
  u16(view, 10, 0);
  u16(view, 12, entry.time);
  u16(view, 14, entry.date);
  u32(view, 16, entry.crc);
  u32(view, 20, entry.size);
  u32(view, 24, entry.size);
  u16(view, 28, entry.nameBytes.length);
  u32(view, 42, entry.offset);
  out.set(entry.nameBytes, 46);
  return out;
};

const endCentralDirectory = (entryCount: number, centralSize: number, centralOffset: number) => {
  const out = new Uint8Array(22);
  const view = new DataView(out.buffer);
  u32(view, 0, 0x06054b50);
  u16(view, 8, entryCount);
  u16(view, 10, entryCount);
  u32(view, 12, centralSize);
  u32(view, 16, centralOffset);
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { files = [], zipName = 'papers' } = await req.json();
    const requestedFiles = (Array.isArray(files) ? files : [])
      .map((file: ZipFile) => ({
        path: String(file?.path || '').trim(),
        zipName: sanitizeZipName(file?.zipName || ''),
      }))
      .filter((file: ZipFile) => file.path && file.zipName)
      .slice(0, 600);

    if (requestedFiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No files requested' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !publishableKey) throw new Error('Storage credentials are not configured');

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || `Bearer ${publishableKey}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const courierIds = Array.from(new Set(requestedFiles.map((file) => file.path.split('/')[0]).filter(Boolean)));
    const { data: couriers, error: courierError } = await supabase
      .from('manpower')
      .select('id')
      .in('id', courierIds);
    if (courierError) throw courierError;

    const allowedCourierIds = new Set((couriers || []).map((courier: { id: string }) => courier.id));
    const safeFiles = requestedFiles.filter((file) => {
      const [courierId, fileName, ...rest] = file.path.split('/');
      return allowedCourierIds.has(courierId) && Boolean(fileName) && rest.length === 0 && !fileName.includes('..');
    });

    if (safeFiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No allowed files requested' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data: signedFiles, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(safeFiles.map((file) => file.path), 60 * 20);
    if (signedError) throw signedError;

    const signedByPath = new Map<string, string>();
    (signedFiles || []).forEach((file) => {
      if (file.path && file.signedUrl) signedByPath.set(file.path, file.signedUrl);
    });
    const streamFiles = safeFiles.filter((file) => signedByPath.has(file.path));

    if (streamFiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No files could be signed' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const centralEntries: CentralEntry[] = [];
        let offset = 0;

        const push = (chunk: Uint8Array) => {
          controller.enqueue(chunk);
          offset += chunk.length;
        };

        try {
          for (const file of streamFiles) {
            const url = signedByPath.get(file.path);
            if (!url) continue;

            const response = await fetch(url);
            if (!response.ok || !response.body) {
              console.error(`Failed to stream ${file.path}: ${response.status}`);
              continue;
            }

            const nameBytes = encoder.encode(file.zipName);
            const { time, date } = dosDateTime();
            const entryOffset = offset;
            push(localHeader(nameBytes, time, date));

            const reader = response.body.getReader();
            let crc = 0xffffffff;
            let size = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!value) continue;
              crc = crc32Update(crc, value);
              size += value.length;
              push(value);
            }

            const finalCrc = (crc ^ 0xffffffff) >>> 0;
            push(dataDescriptor(finalCrc, size));
            centralEntries.push({ nameBytes, crc: finalCrc, size, offset: entryOffset, time, date });
          }

          const centralOffset = offset;
          for (const entry of centralEntries) push(centralHeader(entry));
          const centralSize = offset - centralOffset;
          push(endCentralDirectory(centralEntries.length, centralSize, centralOffset));
          controller.close();
        } catch (error) {
          console.error('ZIP stream failed', error);
          controller.error(error);
        }
      },
    });

    const safeDownloadName = sanitizeZipName(`${zipName}.zip`).split('/').pop() || 'papers.zip';

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeDownloadName)}`,
        'Cache-Control': 'no-store',
        'X-Files-Requested': String(streamFiles.length),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
