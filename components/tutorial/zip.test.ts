/* ============================================================
   The zip writer, held against the format instead of against itself.
   ------------------------------------------------------------
   A captured golden blob would pass for the wrong reason: it would only say the writer
   still emits what it emitted on the day the fixture was taken, whatever was wrong with
   it then. These cells read the archive back the way an extractor does, by parsing the
   fields at the offsets APPNOTE.TXT puts them at, so the expectations come from the
   format and not from the code under test.

   ── The defect this file exists to catch ──
   `data.length` on the encoded array and `text.length` on the string are the same number
   for ASCII and different for everything else. A writer that reaches for the string
   length writes a short size into the header, the extractor truncates the entry there,
   and the reader gets a CRC error on a file the page had perfectly in memory. Nothing in
   an ASCII fixture can see that, so the fixtures here are deliberately not all ASCII:
   two cells put multi-byte characters in an entry's text and one puts them in its path.

   ── Why the CRC check values are read out of an archive ──
   `crc32` is private to `zip.ts`. Exporting it so a cell could call it would leave an
   export with no caller in the product, which is the shape the note on `RUNNABLE_DOT` in
   `components/blueprint/download-name.test.ts` records having to unpick later. The two
   standard check values are read out of a one-entry archive's header instead: 0 for the
   empty string, 0xCBF43926 for "123456789".
   ============================================================ */

import { describe, expect, it } from "vitest";

import { storedZip, type ZipEntry } from "./zip";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_RECORD = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** No comment and no zip64 locator, so the end record is the last 22 bytes. */
const END_LENGTH = 22;

/** The standard CRC-32 check value, the one every implementation is published against. */
const CHECK_VALUE = 0xcbf43926;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

interface Archive {
  bytes: Uint8Array;
  view: DataView;
}

async function build(entries: readonly ZipEntry[]): Promise<Archive> {
  const bytes = new Uint8Array(await storedZip(entries).arrayBuffer());
  return { bytes, view: new DataView(bytes.buffer) };
}

interface LocalEntry {
  path: string;
  text: string;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
}

/**
 * Walk the local headers the way an extractor without a central directory would: read the
 * name and size out of each header and use them to find the next one. A length field that
 * is wrong by even a byte desynchronises the walk and the next signature check fails,
 * which is why this is the reader the round-trip cells go through.
 */
function readLocalEntries(archive: Archive, upTo: number): LocalEntry[] {
  const found: LocalEntry[] = [];
  let cursor = 0;
  while (cursor < upTo) {
    expect(
      archive.view.getUint32(cursor, true),
      `no local file header at ${cursor}`,
    ).toBe(LOCAL_HEADER);
    const compressedSize = archive.view.getUint32(cursor + 18, true);
    const nameLength = archive.view.getUint16(cursor + 26, true);
    const extraLength = archive.view.getUint16(cursor + 28, true);
    const nameAt = cursor + 30;
    const dataAt = nameAt + nameLength + extraLength;
    found.push({
      path: decoder.decode(archive.bytes.subarray(nameAt, nameAt + nameLength)),
      text: decoder.decode(archive.bytes.subarray(dataAt, dataAt + compressedSize)),
      compressedSize,
      uncompressedSize: archive.view.getUint32(cursor + 22, true),
      nameLength,
    });
    cursor = dataAt + compressedSize;
  }
  return found;
}

/** The end of central directory record, read from the tail. */
function readEnd(archive: Archive) {
  const at = archive.bytes.length - END_LENGTH;
  return {
    signature: archive.view.getUint32(at, true),
    onThisDisk: archive.view.getUint16(at + 8, true),
    total: archive.view.getUint16(at + 10, true),
    centralSize: archive.view.getUint32(at + 12, true),
    centralOffset: archive.view.getUint32(at + 16, true),
  };
}

/**
 * A folder shaped like the one `/tutorial` writes: the two files at the root, two cards
 * under a prefix, the scenario the rubric step adds. The README carries characters no
 * single-byte encoding has, because a reader writes that summary and can write it in any
 * language. It is what makes the byte-length assertions below bite.
 */
const BUNDLE: readonly ZipEntry[] = [
  { path: "topology.dot", text: 'digraph desk {\n  n1 [label="fetch"];\n}\n' },
  {
    path: "README.md",
    text: "# Rassegna\n\nUna rassegna che cita ogni voce: è già pronta: caffè ☕\n",
  },
  { path: "cards/fetch-seeds@1.0.0.yaml", text: "id: fetch-seeds\nversion: 1.0.0\n" },
  { path: "cards/grade-claims@1.0.0.yaml", text: "id: grade-claims\nversion: 1.0.0\n" },
  { path: "evals/scenario.yaml", text: "rubric:\n  - criterion: coverage\n" },
];

describe("storedZip", () => {
  it("writes a local file header at the offsets the format specifies", async () => {
    /* A 12-byte name against 9 bytes of content, so a name length written into a size
       field (or the reverse) cannot pass by coincidence. */
    const archive = await build([{ path: "topology.dot", text: "123456789" }]);

    expect(archive.view.getUint32(0, true)).toBe(LOCAL_HEADER);
    expect(archive.view.getUint16(4, true), "version needed").toBe(20);
    expect(archive.view.getUint16(8, true), "method must be stored").toBe(0);
    expect(archive.view.getUint32(14, true), "crc").toBe(CHECK_VALUE);
    expect(archive.view.getUint32(18, true), "compressed size").toBe(9);
    expect(archive.view.getUint32(22, true), "uncompressed size").toBe(9);
    expect(archive.view.getUint16(26, true), "name length").toBe(12);
    expect(archive.view.getUint16(28, true), "extra length").toBe(0);
    expect(decoder.decode(archive.bytes.subarray(30, 42))).toBe("topology.dot");
    expect(decoder.decode(archive.bytes.subarray(42, 51))).toBe("123456789");
  });

  it("computes the published CRC-32 check values", async () => {
    const empty = await build([{ path: "a", text: "" }]);
    expect(empty.view.getUint32(14, true), 'crc32("")').toBe(0);
    expect(empty.view.getUint32(18, true)).toBe(0);
    expect(empty.view.getUint32(22, true)).toBe(0);

    const check = await build([{ path: "a", text: "123456789" }]);
    expect(check.view.getUint32(14, true), 'crc32("123456789")').toBe(CHECK_VALUE);
  });

  it("sizes an entry in bytes and not in characters", async () => {
    const text = "è già pronta ☕";
    const expected = encoder.encode(text).length;
    const archive = await build([{ path: "README.md", text }]);

    expect(expected, "fixture must not be ASCII, or this cell proves nothing").toBeGreaterThan(
      text.length,
    );
    expect(archive.view.getUint32(18, true), "compressed size is a byte count").toBe(expected);
    expect(archive.view.getUint32(22, true), "uncompressed size is a byte count").toBe(expected);
    /* The header claims everything up to the central directory, so a size short by the
       bytes the accents and the emoji add leaves the tail of the file unaccounted for. */
    expect(readEnd(archive).centralOffset).toBe(30 + "README.md".length + expected);
  });

  it("keeps the archive parseable when a path leaves ASCII", async () => {
    /* `zip.ts` documents that it is only ever handed ASCII paths, and that limit is about
       which codepage a reader decodes the NAME with. It is not licence for the name length
       to be a character count: that field is how every later header is found, so a short
       one desynchronises the walk and the reader gets an archive that will not open at all
       rather than one file with an odd name. Added because a mutation that took the name
       length off the string survived every other cell here: they all use ASCII paths, where
       the two counts agree. */
    const path = "cards/caffè.yaml";
    const archive = await build([{ path, text: "id: x\n" }]);

    const end = readEnd(archive);
    expect(encoder.encode(path).length).toBeGreaterThan(path.length);
    expect(archive.view.getUint16(26, true), "name length is a byte count").toBe(
      encoder.encode(path).length,
    );
    /* The central directory carries its own copy of the name and its own length field, so
       it is a second place the same defect can live. */
    expect(
      archive.view.getUint16(end.centralOffset + 28, true),
      "central name length is a byte count",
    ).toBe(encoder.encode(path).length);
    expect(readLocalEntries(archive, end.centralOffset)).toHaveLength(1);
  });

  it("stores every entry so it decodes back to the exact input text", async () => {
    const archive = await build(BUNDLE);
    const end = readEnd(archive);
    const found = readLocalEntries(archive, end.centralOffset);

    expect(found.map((entry) => ({ path: entry.path, text: entry.text }))).toEqual(
      BUNDLE.map((entry) => ({ path: entry.path, text: entry.text })),
    );
    for (const [index, entry] of found.entries()) {
      const source = BUNDLE[index];
      expect(entry.compressedSize, `${entry.path} compressed size`).toBe(
        encoder.encode(source.text).length,
      );
      expect(entry.uncompressedSize, `${entry.path} uncompressed size`).toBe(
        entry.compressedSize,
      );
      expect(entry.nameLength, `${entry.path} name length`).toBe(
        encoder.encode(source.path).length,
      );
    }
  });

  it("ends with a record that agrees with the parts actually emitted", async () => {
    const archive = await build(BUNDLE);
    const end = readEnd(archive);

    expect(end.signature).toBe(END_OF_CENTRAL_DIRECTORY);
    expect(end.onThisDisk, "entries on this disk").toBe(BUNDLE.length);
    expect(end.total, "entries in total").toBe(BUNDLE.length);
    /* The three regions have to tile the file exactly: local entries, then the central
       directory, then this record. Any gap or overlap is an offset field that lies. */
    expect(end.centralOffset + end.centralSize + END_LENGTH).toBe(archive.bytes.length);

    let cursor = end.centralOffset;
    for (const [index, source] of BUNDLE.entries()) {
      expect(archive.view.getUint32(cursor, true), `central record ${index}`).toBe(
        CENTRAL_RECORD,
      );
      const nameLength = archive.view.getUint16(cursor + 28, true);
      const localAt = archive.view.getUint32(cursor + 42, true);
      expect(
        decoder.decode(archive.bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
      ).toBe(source.path);
      expect(archive.view.getUint32(localAt, true), `${source.path} local offset`).toBe(
        LOCAL_HEADER,
      );
      /* Named separately from the CRC below because a wrong offset lands on some other
         entry's header, which still reads as a valid one: without this the failure would
         surface two lines down and blame the CRC for a defect in the offset. */
      const localNameLength = archive.view.getUint16(localAt + 26, true);
      expect(
        decoder.decode(
          archive.bytes.subarray(localAt + 30, localAt + 30 + localNameLength),
        ),
        `${source.path} must be seeked to by its own central record`,
      ).toBe(source.path);
      expect(
        archive.view.getUint32(cursor + 16, true),
        `${source.path} crc must match its local header`,
      ).toBe(archive.view.getUint32(localAt + 14, true));
      expect(
        archive.view.getUint32(cursor + 20, true),
        `${source.path} compressed size must match its local header`,
      ).toBe(archive.view.getUint32(localAt + 18, true));
      expect(
        archive.view.getUint32(cursor + 24, true),
        `${source.path} uncompressed size must match its local header`,
      ).toBe(archive.view.getUint32(localAt + 22, true));
      const extraLength = archive.view.getUint16(cursor + 30, true);
      const commentLength = archive.view.getUint16(cursor + 32, true);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    expect(cursor, "central directory size").toBe(end.centralOffset + end.centralSize);
  });

  it("writes an archive of no files as the end record alone", async () => {
    const archive = await build([]);
    const end = readEnd(archive);

    expect(archive.bytes.length).toBe(END_LENGTH);
    expect(end.signature).toBe(END_OF_CENTRAL_DIRECTORY);
    expect(end.total).toBe(0);
    expect(end.centralSize).toBe(0);
    expect(end.centralOffset).toBe(0);
  });
});
