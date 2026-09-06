/* ============================================================
   A stored zip, assembled in the tab.
   ------------------------------------------------------------
   `/tutorial` builds a blueprint folder in the browser and hands it back as one
   download. Nothing is uploaded, so the archive has to be written on the page, and the
   constraint sheet forbids taking a dependency to write it. That is affordable here
   because the page already holds every file it is about to archive as a string: nothing
   has to be streamed, and nothing has to be held open while it is read. What is left is
   a few length fields in the order the format wants them.

   ── Stored, never deflated ──
   A finished bundle is six to eight small text files. A deflate implementation is
   Huffman coding plus a sliding window, and it would ride in the bundle of every reader
   who opens the tutorial in order to save a few kilobytes for the one who finishes it.
   A stored entry costs one CRC pass over bytes that are already in memory. The size
   fields below are the format's ordinary 32-bit ones rather than zip64, which a folder
   measured in kilobytes has no way to reach.

   ── Two limits taken on purpose ──

   1. No directory entries are emitted. `cards/` and `evals/` exist in the archive only
      as a prefix on the paths of the files inside them. `unzip` creates the intermediate
      directories implicitly when it extracts those paths, so the zero-length records
      would add bytes and change nothing the reader ends up with.

   2. The UTF-8 name flag (general-purpose bit 11) is not set, so an entry path outside
      ASCII would be decoded by the reader's local codepage rather than as UTF-8. What
      makes that safe is the set of paths this writer is given and nothing wider: every
      one is `topology.dot`, `README.md`, `cards/<id>@<version>.yaml` or
      `evals/scenario.yaml`, and a card id is lowercase letters, digits and hyphens with
      an optional `<namespace>/` in front, pinned by `CARD_ID` in
      `lib/core/card/schema.ts`. Those are all ASCII, where the two decodings agree. A
      caller that ever passes a path built from something a reader typed has to set the
      flag before it does.

   File CONTENTS are outside that limit. They are stored as raw UTF-8 bytes and come back
   out byte for byte, whatever alphabet the reader wrote their summary in.
   ============================================================ */

/** One file in the archive: `path` is the name it takes inside the zip, `/`-separated. */
export interface ZipEntry {
  readonly path: string;
  readonly text: string;
}

/* Field offsets below are APPNOTE.TXT 4.3.7 (local header), 4.3.12 (central directory
   record) and 4.3.16 (end of central directory), little-endian throughout. */
const LOCAL_HEADER = 0x04034b50;
const CENTRAL_RECORD = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** 2.0, the lowest version that reads a stored entry with its sizes in the header. */
const VERSION_NEEDED = 20;

/**
 * CRC-32 over the reflected 0xedb88320 polynomial, which is the one the zip format is
 * defined against. Computed a bit at a time rather than through the usual 256-entry
 * table: the whole archive is a handful of kilobytes, so the table would cost more to
 * build than the loop it replaces saves.
 */
function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crc ^ bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

/** A stored (uncompressed) zip. */
export function storedZip(entries: readonly ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  /* Runs ahead of the loop as the position of the next local header, and is the offset of
     the central directory once every entry has been written. */
  let offset = 0;

  for (const entry of entries) {
    /* Both lengths have to come off the ENCODED arrays. A `.length` on either string is
       the character count, which is short for anything outside ASCII, and an extractor
       reading a short size truncates the entry and then reports a CRC mismatch on it. */
    const data = encoder.encode(entry.text);
    const name = encoder.encode(entry.path);
    const crc = crc32(data);

    /* Left zero, deliberately: the flag word at 6, the compression method at 8 (0 is
       stored), and the DOS modification time and date at 10. A wall clock in those two
       fields would make two downloads of the same folder differ byte for byte, which
       costs a reader the cheapest check there is that they got the same thing twice. */
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_HEADER, true);
    localView.setUint16(4, VERSION_NEEDED, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);

    /* The same fields again, two bytes further along because the central record carries a
       version-made-by ahead of the version-needed, and with the local header's offset at
       42. That offset is what an extractor seeks to, so a central record disagreeing with
       its local header is what a reader sees as a corrupt archive. */
    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, CENTRAL_RECORD, true);
    recordView.setUint16(4, VERSION_NEEDED, true);
    recordView.setUint16(6, VERSION_NEEDED, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, data.length, true);
    recordView.setUint32(24, data.length, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);

    offset += local.length + data.length;
  }

  let centralSize = 0;
  for (const record of central) centralSize += record.length;

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  /*
   * Joined into one array rather than handed to `Blob` as a list of views.
   *
   * `TextEncoder.encode` is typed `Uint8Array<ArrayBufferLike>` and `BlobPart` wants
   * `ArrayBufferView<ArrayBuffer>`, so the list form does not typecheck: `ArrayBufferLike`
   * admits a `SharedArrayBuffer`, which a `Blob` cannot take. Copying into a buffer this
   * function allocated resolves that by construction instead of by a cast, and a cast here
   * would be asserting something about `TextEncoder` that nothing checks. The archive is a
   * handful of kilobytes and already entirely in memory, so the second pass costs nothing
   * worth naming.
   */
  const pieces = [...parts, ...central, end];
  let total = 0;
  for (const piece of pieces) total += piece.length;
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const piece of pieces) {
    bytes.set(piece, at);
    at += piece.length;
  }
  return new Blob([bytes], { type: "application/zip" });
}
