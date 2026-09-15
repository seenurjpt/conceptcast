import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHeadlines } from '../src/lib/concepts/timeliness';

test('extractHeadlines reads RSS items and Atom entries, decoding CDATA and entities', () => {
  const rss = `<?xml version="1.0"?><rss><channel><title>Feed title</title>
    <item><title><![CDATA[New model ships 1M context & 2x speed]]></title></item>
    <item><title>Plain &amp; simple &lt;title&gt;</title></item>
  </channel></rss>`;
  assert.deepEqual(extractHeadlines(rss), ['New model ships 1M context & 2x speed', 'Plain & simple <title>']);

  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Site</title>
    <entry><title type="html">Prompt caching explained</title></entry>
  </feed>`;
  assert.deepEqual(extractHeadlines(atom), ['Prompt caching explained']);
});

test('extractHeadlines ignores the channel title and empty items', () => {
  assert.deepEqual(extractHeadlines('<rss><channel><title>Only channel</title></channel></rss>'), []);
  assert.deepEqual(extractHeadlines('<rss><item><title>  </title></item></rss>'), []);
});
