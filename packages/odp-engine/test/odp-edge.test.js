import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseODP } from '../src/index.js';
import { buildOdf } from '../../../test/helpers/odf.js';
import { buildZip } from '../../../test/helpers/zip.js';

const LAYOUT = `
<style:page-layout style:name="pm1">
  <style:page-layout-properties fo:page-width="28cm" fo:page-height="21cm"
    fo:margin-top="0cm" fo:margin-bottom="0cm" fo:margin-left="0cm" fo:margin-right="0cm"/>
</style:page-layout>`;

const MASTER = `
<style:master-page style:name="Default" style:page-layout-name="pm1">
  <style:drawing-page-properties draw:fill="solid" draw:fill-color="#fafafa"/>
</style:master-page>`;

async function parseBody(body, options = {}) {
  return parseODP(await buildOdf('odp', {
    body,
    styles: options.styles || '',
    layoutStyles: LAYOUT,
    masterPages: MASTER,
  }));
}

test('descends into groups and keeps headings inside text boxes', async () => {
  const deck = await parseBody(`
    <office:presentation>
      <draw:page draw:name="Grouped" draw:master-page-name="Default">
        <draw:g>
          <draw:frame draw:style-name="Pos">
            <draw:text-box>
              <text:h text:outline-level="1">Headline</text:h>
              <text:p>Body<text:s text:c="2"/>spaced</text:p>
            </draw:text-box>
          </draw:frame>
        </draw:g>
      </draw:page>
    </office:presentation>`, {
    styles: `
      <style:style style:name="Pos" style:family="graphic">
        <style:graphic-properties svg:x="3cm" svg:y="4cm" svg:width="5cm" svg:height="2cm"/>
      </style:style>`,
  });

  const element = deck.slides[0].elements[0];
  assert.equal(element.type, 'text-box');
  assert.deepEqual(element.geometry, { x: '3cm', y: '4cm', width: '5cm', height: '2cm' });
  assert.deepEqual(element.content.paragraphs.map((paragraph) => paragraph.text), [
    'Headline',
    'Body  spaced',
  ]);

  const html = deck.toHTML();
  assert.match(html, /left:10\.714%;top:19\.048%;width:17\.857%;height:9\.524%/);
  assert.match(html, /<p class="odp-paragraph"[^>]*>Headline<\/p>/);
  deck.destroy();
});

test('skips notes pages, notes frames and names missing slides', async () => {
  const deck = await parseBody(`
    <office:presentation>
      <draw:page draw:name="Visible" draw:master-page-name="Default">
        <presentation:notes>
          <draw:frame svg:width="10cm" svg:height="4cm">
            <draw:text-box><text:p>Hidden note</text:p></draw:text-box>
          </draw:frame>
        </presentation:notes>
      </draw:page>
      <draw:page draw:name="Notes page" draw:class="notes" draw:master-page-name="Default">
        <draw:frame svg:width="10cm" svg:height="4cm">
          <draw:text-box><text:p>Also hidden</text:p></draw:text-box>
        </draw:frame>
      </draw:page>
      <draw:page draw:master-page-name="Default"/>
    </office:presentation>`);

  assert.equal(deck.meta.slideCount, 2);
  assert.deepEqual(deck.slides.map((slide) => slide.name), ['Visible', 'Slide 2']);
  assert.deepEqual(deck.slides[0].elements, []);
  assert.deepEqual(deck.slides[1].elements, []);
  assert.equal(JSON.stringify(deck.toAST()).includes('Hidden'), false);

  const html = deck.toHTML();
  assert.equal((html.match(/class="odp-slide"/g) || []).length, 2);
  assert.match(html, /data-slide="2"[^>]*background:#fafafa/);
  deck.destroy();
});

test('escapes Markdown text and supports image-only slides', async () => {
  const bytes = await buildOdf('odp', {
    body: `
      <office:presentation>
        <draw:page draw:name="Image" draw:master-page-name="Default">
          <draw:frame svg:x="1cm" svg:y="1cm" svg:width="5cm" svg:height="3cm">
            <draw:image xlink:href="https://example.com/slide.png"/>
          </draw:frame>
        </draw:page>
        <draw:page draw:name="Text" draw:master-page-name="Default">
          <draw:frame svg:x="1cm" svg:y="1cm" svg:width="10cm" svg:height="5cm">
            <draw:text-box>
              <text:p>*star* [bracket]</text:p>
              <text:p>_under_</text:p>
            </draw:text-box>
          </draw:frame>
        </draw:page>
      </office:presentation>`,
    layoutStyles: LAYOUT,
    masterPages: MASTER,
  });
  const deck = await parseODP(bytes);
  const markdown = deck.toMarkdown();

  assert.match(markdown, /!\[Slide 1 image\]\(https:\/\/example\.com\/slide\.png\)/);
  assert.match(markdown, /### \\\*star\\\* \\\[bracket\\\]/);
  assert.match(markdown, /- \\_under\\_/);
  assert.equal(markdown.startsWith('---'), false);
  deck.destroy();
});

test('renders zero geometry and escapes HTML text', async () => {
  const deck = await parseBody(`
    <office:presentation>
      <draw:page draw:name="Zero" draw:master-page-name="Default">
        <draw:rect draw:style-name="Box" svg:x="0cm" svg:y="0cm" svg:width="3cm" svg:height="2cm">
          <text:p>A &lt; B &amp; C</text:p>
        </draw:rect>
      </draw:page>
    </office:presentation>`, {
    styles: `
      <style:style style:name="Box" style:family="graphic">
        <style:graphic-properties draw:fill="solid" draw:fill-color="#ffeeaa" draw:stroke="none"/>
      </style:style>`,
  });

  const element = deck.slides[0].elements[0];
  assert.equal(element.shape, 'rect');
  assert.equal(element.type, 'shape');
  assert.deepEqual(element.geometry, { x: '0cm', y: '0cm', width: '3cm', height: '2cm' });

  const html = deck.toHTML();
  assert.match(html, /left:0%;top:0%;width:10\.714%;height:9\.524%;position:absolute/);
  assert.match(html, />A &lt; B &amp; C<\/p>/);
  deck.destroy();
});

test('treats an empty or foreign container as an empty deck', async () => {
  const foreign = await parseODP(await buildOdf('odt', {
    body: '<office:text><text:p>Not a slide</text:p></office:text>',
  }));
  assert.equal(foreign.meta.slideCount, 0);
  assert.deepEqual(foreign.slides, []);
  assert.equal(foreign.meta.dimensions.width, '25.4cm');
  assert.equal(foreign.toMarkdown(), '\n');
  assert.match(foreign.toHTML(), /<main class="odp-deck"><\/main>/);
  foreign.destroy();

  const empty = await parseBody('<office:presentation/>');
  assert.equal(empty.meta.slideCount, 0);
  empty.destroy();
});

test('rejects archives without content.xml', async () => {
  const bytes = await buildZip([
    { name: 'mimetype', content: 'application/vnd.oasis.opendocument.presentation', store: true },
  ]);
  await assert.rejects(
    () => parseODP(bytes),
    (error) => error.code === 'NOT_ODF',
  );
});
