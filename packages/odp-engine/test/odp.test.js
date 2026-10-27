import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseODP } from '../src/index.js';
import { buildOdf, PAGE_LAYOUT, TINY_PNG } from '../../../test/helpers/odf.js';

const STYLES = `
<style:style style:name="Title" style:family="paragraph">
  <style:text-properties fo:font-size="32pt" fo:font-weight="bold"/>
</style:style>
<style:style style:name="Body" style:family="paragraph">
  <style:text-properties fo:font-size="16pt"/>
</style:style>
<style:style style:name="TitleBox" style:family="graphic">
  <style:graphic-properties fo:padding="0.2cm"/>
</style:style>
<style:style style:name="Box" style:family="graphic">
  <style:graphic-properties draw:fill="solid" draw:fill-color="#ffcc00" draw:stroke="none"/>
</style:style>`;

const BODY = `
<office:presentation>
  <draw:page draw:name="Intro" draw:master-page-name="Default">
    <draw:frame presentation:style-name="TitleBox" svg:x="2cm" svg:y="1.5cm" svg:width="24cm" svg:height="4cm">
      <draw:text-box><text:p text:style-name="Title">Welcome</text:p></draw:text-box>
    </draw:frame>
    <draw:frame svg:x="2cm" svg:y="7cm" svg:width="20cm" svg:height="10cm">
      <draw:text-box>
        <text:p text:style-name="Body">Agenda item one</text:p>
        <text:list>
          <text:list-item><text:p text:style-name="Body">Bullet A</text:p></text:list-item>
          <text:list-item><text:p text:style-name="Body">Bullet B</text:p></text:list-item>
        </text:list>
      </draw:text-box>
    </draw:frame>
    <draw:frame svg:x="23cm" svg:y="16cm" svg:width="4cm" svg:height="4cm">
      <draw:image xlink:href="Pictures/slide-logo.png"/>
    </draw:frame>
    <draw:rect draw:style-name="Box" svg:x="1cm" svg:y="18cm" svg:width="5cm" svg:height="2cm"/>
    <presentation:notes>
      <draw:frame svg:width="10cm" svg:height="4cm">
        <draw:text-box><text:p>Speaker notes are hidden</text:p></draw:text-box>
      </draw:frame>
    </presentation:notes>
  </draw:page>
  <draw:page draw:name="Second slide" draw:master-page-name="Default">
    <draw:frame svg:x="3cm" svg:y="3cm" svg:width="10cm" svg:height="5cm">
      <draw:text-box><text:p text:style-name="Title">Wrap up</text:p></draw:text-box>
    </draw:frame>
  </draw:page>
</office:presentation>`;

async function parseFixture({ withLayout = true } = {}) {
  const bytes = await buildOdf('odp', {
    body: BODY,
    styles: STYLES,
    layoutStyles: withLayout ? PAGE_LAYOUT.replace('21cm', '28cm').replace('29.7cm', '21cm') : '',
    masterPages: withLayout
      ? `<style:master-page style:name="Default" style:page-layout-name="pm1">
           <style:drawing-page-properties draw:fill="solid" draw:fill-color="#fafafa"/>
         </style:master-page>`
      : '',
    pictures: { 'slide-logo.png': TINY_PNG },
  });
  return parseODP(bytes);
}

test('reads slide count, dimensions and master backgrounds', async () => {
  const deck = await parseFixture();
  assert.equal(deck.meta.format, 'odp');
  assert.equal(deck.meta.slideCount, 2);
  assert.equal(deck.meta.dimensions.width, '28cm');
  assert.equal(deck.meta.dimensions.height, '21cm');
  assert.equal(deck.slides[0].name, 'Intro');
  assert.equal(deck.slides[1].slideNumber, 2);
  assert.equal(deck.slides[0].background, '#fafafa');
});

test('falls back to a 4:3 canvas when no page layout exists', async () => {
  const deck = await parseFixture({ withLayout: false });
  assert.equal(deck.meta.dimensions.width, '25.4cm');
  assert.equal(deck.meta.dimensions.height, '19.05cm');
});

test('extracts text boxes, bullets, images and shapes in z-order', async () => {
  const deck = await parseFixture();
  const elements = deck.slides[0].elements;

  assert.equal(elements.length, 4);
  assert.deepEqual(elements.map((element) => element.type), ['text-box', 'text-box', 'image', 'shape']);

  assert.equal(elements[0].content.paragraphs[0].text, 'Welcome');
  assert.deepEqual(elements[0].geometry, {
    x: '2cm',
    y: '1.5cm',
    width: '24cm',
    height: '4cm',
  });

  const agenda = elements[1].content.paragraphs;
  assert.equal(agenda.length, 3);
  assert.equal(agenda[1].text, 'Bullet A');
  assert.equal(agenda[1].bullet, true);
  assert.equal(agenda[2].text, 'Bullet B');

  assert.match(elements[2].content.imageSrc, /^(blob:|data:)/);
  assert.equal(elements[3].shape, 'rect');
  assert.equal(elements[3].style, 'Box');

  const notes = JSON.stringify(deck.slides);
  assert.equal(notes.includes('Speaker notes'), false);
});

test('positions elements with slide-relative percentages in HTML', async () => {
  const deck = await parseFixture();
  const html = deck.toHTML();

  assert.match(html, /@page\{size:28cm 21cm;margin:0\}/);
  assert.match(html, /class="odp-slide"/);
  assert.match(html, /left:7\.143%/);
  assert.match(html, /top:7\.143%/);
  assert.match(html, /width:85\.714%/);
  assert.match(html, /height:19\.048%/);
  assert.match(html, /background:#fafafa/);
  assert.match(html, /<p class="odp-bullet"[^>]*><span class="odp-bullet-mark"/);
  assert.match(html, /<img class="odp-image" src="(?:blob|data):[^"]*"/);
  assert.match(html, /page-break-after:always/);
  assert.match(html, /<div class="odp-shape"[^>]*background-color:#ffcc00/);
  assert.equal((html.match(/class="odp-slide"/g) || []).length, 2);
});

test('renders a Markdown transcript with slide sections', async () => {
  const markdown = await deckMarkdown();

  assert.match(markdown, /^## Slide 1/m);
  assert.match(markdown, /### Welcome/);
  assert.match(markdown, /- Agenda item one/);
  assert.match(markdown, /- Bullet A/);
  assert.match(markdown, /!\[Slide 1 image\]\((?:blob|data):/);
  assert.match(markdown, /\n---\n/);
  assert.match(markdown, /## Slide 2/);
  assert.match(markdown, /### Wrap up/);
  assert.equal(markdown.startsWith('---'), false);
});

async function deckMarkdown() {
  const deck = await parseFixture();
  return deck.toMarkdown();
}

test('destroy releases embedded image URLs', async () => {
  const deck = await parseFixture();
  assert.equal(Object.keys(deck.resources.images).length, 1);
  deck.destroy();
  assert.equal(Object.keys(deck.resources.images).length, 0);
});
