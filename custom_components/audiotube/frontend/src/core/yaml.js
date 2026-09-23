/**
 * Minimal YAML serializer/parser for AudioTube backup files.
 *
 * This is NOT a general-purpose YAML implementation — it only supports the
 * exact block-style subset this module itself writes (2-space indented
 * mappings and `- key: value` sequences of flat objects, arbitrarily
 * nested), which is enough to round-trip {favorites, playlists} backups
 * and to survive reasonable hand edits. It intentionally does not support
 * flow style (`{a: 1}`/`[1,2]`), anchors, multi-line strings, etc.
 * @module core/yaml
 */

function needsQuoting(str) {
  if (str === '') return true;
  if (/^\s|\s$/.test(str)) return true;
  if (/^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(str)) return true;
  return /[:#\[\]{}&*!|>'"%@`,]/.test(str);
}

function renderScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const str = String(value);
  return needsQuoting(str) ? JSON.stringify(str) : str;
}

function renderValue(value, indent) {
  if (Array.isArray(value)) {
    if (value.length === 0) return ' []\n';
    return '\n' + value.map(item => renderListItem(item, indent)).join('');
  }
  if (value && typeof value === 'object') {
    return '\n' + renderMapping(value, indent);
  }
  return ' ' + renderScalar(value) + '\n';
}

function renderMapping(obj, indent) {
  const pad = ' '.repeat(indent);
  return Object.entries(obj)
    .map(([k, v]) => `${pad}${k}:${renderValue(v, indent + 2)}`)
    .join('');
}

function renderListItem(item, indent) {
  const pad = ' '.repeat(indent);
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return Object.entries(item)
      .map(([k, v], i) => `${pad}${i === 0 ? '- ' : '  '}${k}:${renderValue(v, indent + 4)}`)
      .join('');
  }
  return `${pad}- ${renderScalar(item)}\n`;
}

/** Serialize a plain object (of the shapes described above) to a YAML string. */
export function stringify(value) {
  if (Array.isArray(value) || typeof value !== 'object' || value === null) {
    throw new TypeError('yaml.stringify: top-level value must be a plain object');
  }
  return renderMapping(value, 0);
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function tokenizeLines(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '' || /^\s*#/.test(raw)) continue; // skip blanks/comments
    const indent = raw.match(/^ */)[0].length;
    lines.push({ indent, text: raw.slice(indent) });
  }
  return lines;
}

function findColon(text) {
  if (text.startsWith('"')) {
    let i = 1;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"') { i += 1; break; }
      i += 1;
    }
    return text[i] === ':' ? i : -1;
  }
  const idx = text.indexOf(':');
  return idx;
}

function parseScalar(text) {
  if (text === '') return null;
  if (text.startsWith('"')) {
    try { return JSON.parse(text); } catch { /* fall through */ }
  }
  if (text === 'null' || text === '~') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return parseInt(text, 10);
  if (/^-?\d+\.\d+$/.test(text)) return parseFloat(text);
  return text;
}

/** Parse the block-style YAML subset produced by `stringify()`. */
export function parse(text) {
  const lines = tokenizeLines(text);
  let pos = 0;

  function parseBlockAt(indent) {
    if (pos >= lines.length || lines[pos].indent < indent) return null;
    return lines[pos].text.startsWith('- ') ? parseSequence(indent) : parseMapping(indent);
  }

  function nestedIndentOrDefault(fallback) {
    return pos < lines.length ? lines[pos].indent : fallback;
  }

  function parseMapping(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent && !lines[pos].text.startsWith('- ')) {
      const line = lines[pos];
      const colonIdx = findColon(line.text);
      if (colonIdx === -1) { pos += 1; continue; }
      const key = line.text.slice(0, colonIdx).trim();
      const valueText = line.text.slice(colonIdx + 1).trim();
      pos += 1;
      obj[key] = valueText !== '' ? parseScalar(valueText) : parseBlockAt(nestedIndentOrDefault(indent + 2));
    }
    return obj;
  }

  function parseSequence(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('- ')) {
      const rest = lines[pos].text.slice(2);
      const colonIdx = findColon(rest);
      if (colonIdx === -1) {
        arr.push(parseScalar(rest));
        pos += 1;
        continue;
      }
      // First key/value of an inline mapping list item; continuation keys
      // live on following lines indented to align under it (indent + 2).
      const itemIndent = indent + 2;
      const obj = {};
      const key = rest.slice(0, colonIdx).trim();
      const valueText = rest.slice(colonIdx + 1).trim();
      pos += 1;
      obj[key] = valueText !== '' ? parseScalar(valueText) : parseBlockAt(nestedIndentOrDefault(itemIndent + 2));
      while (pos < lines.length && lines[pos].indent === itemIndent && !lines[pos].text.startsWith('- ')) {
        const line2 = lines[pos];
        const c2 = findColon(line2.text);
        if (c2 === -1) { pos += 1; continue; }
        const k2 = line2.text.slice(0, c2).trim();
        const v2 = line2.text.slice(c2 + 1).trim();
        pos += 1;
        obj[k2] = v2 !== '' ? parseScalar(v2) : parseBlockAt(nestedIndentOrDefault(itemIndent + 2));
      }
      arr.push(obj);
    }
    return arr;
  }

  return parseBlockAt(0) ?? {};
}
