import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseXML } from '../src/xml.js';
import {
  DEFAULT_PAGE_LAYOUT,
  StyleResolver,
  addLayoutStyles,
  listType,
  masterPage,
  pageLayout,
  pageLayoutForMaster,
  toCss,
} from '../src/styles.js';
import { PAGE_LAYOUT, stylesDocument } from '../../../test/helpers/odf.js';

function resolver() {
  const xml = stylesDocument({
    styles: `
      <style:default-style style:family="paragraph">
        <style:text-properties fo:font-size="12pt" fo:color="#111111"/>
      </style:default-style>
      <style:style style:name="Base" style:family="paragraph">
        <style:paragraph-properties fo:margin-top="6pt" fo:text-align="center"/>
        <style:text-properties fo:font-weight="bold"/>
      </style:style>
      <style:style style:name="Child" style:family="paragraph" style:parent-style-name="Base">
        <style:text-properties fo:font-size="10pt" fo:font-style="italic"/>
      </style:style>
      <style:style style:name="Bold" style:family="text">
        <style:text-properties fo:font-weight="bold" style:text-underline-style="solid"/>
      </style:style>
      <style:style style:name="Box" style:family="graphic">
        <style:graphic-properties draw:fill="solid" draw:fill-color="#ffeeaa"
          draw:stroke="solid" svg:stroke-color="#333333" svg:stroke-width="0.05cm"/>
      </style:style>
      <style:list-style style:name="Nums"><text:list-level-style-number text:level="1"/></style:list-style>
      <style:list-style style:name="Dots"><text:list-level-style-bullet text:level="1"/></style:list-style>`,
    automaticStyles: PAGE_LAYOUT,
    masterPages: `
      <style:master-page style:name="Standard" style:page-layout-name="pm1">
        <style:drawing-page-properties draw:fill="solid" draw:fill-color="#fafafa"/>
      </style:master-page>`,
  });
  const doc = parseXML(xml, 'styles.xml');
  const styles = new StyleResolver().addStylesDoc(doc);
  addLayoutStyles(styles, doc, true);
  return styles;
}

test('resolves inheritance chains over family defaults', () => {
  const styles = resolver();
  const css = styles.resolve('Child');

  assert.equal(css['font-size'], '10pt');
  assert.equal(css['font-style'], 'italic');
  assert.equal(css['font-weight'], 'bold');
  assert.equal(css['color'], '#111111');
  assert.equal(css['margin-top'], '6pt');
  assert.equal(css['text-align'], 'center');

  assert.match(toCss(css), /font-size:10pt/);
});

test('maps text decorations and graphic fills and strokes', () => {
  const styles = resolver();

  assert.equal(styles.resolve('Bold')['text-decoration'], 'underline');

  const box = styles.resolve('Box');
  assert.equal(box['background-color'], '#ffeeaa');
  assert.equal(box['border-color'], '#333333');
  assert.equal(box['border-width'], '0.05cm');
  assert.equal(box['border-style'], 'solid');
});

test('exposes page layouts and master page backgrounds', () => {
  const styles = resolver();
  const page = pageLayout(styles, 'pm1');

  assert.equal(page.width, '21cm');
  assert.equal(page.height, '29.7cm');
  assert.equal(page.marginLeft, '2.5cm');
  assert.equal(page.orientation, 'portrait');

  assert.equal(masterPage(styles, 'Standard').css['background-color'], '#fafafa');
  assert.equal(pageLayoutForMaster(styles, 'Standard').width, '21cm');
});

test('detects landscape layouts from dimensions', () => {
  const xml = stylesDocument({
    automaticStyles: `
      <style:page-layout style:name="wide">
        <style:page-layout-properties fo:page-width="29.7cm" fo:page-height="21cm"/>
      </style:page-layout>`,
  });
  const doc = parseXML(xml, 'styles.xml');
  const styles = new StyleResolver().addStylesDoc(doc);
  addLayoutStyles(styles, doc);
  assert.equal(pageLayout(styles, 'wide').orientation, 'landscape');
});

test('falls back to A4 when no page layout exists', () => {
  const xml = stylesDocument({});
  const doc = parseXML(xml, 'styles.xml');
  const styles = new StyleResolver().addStylesDoc(doc);
  addLayoutStyles(styles, doc);
  assert.deepEqual(pageLayout(styles, 'missing'), { ...DEFAULT_PAGE_LAYOUT });
});

test('detects ordered and bullet list styles', () => {
  const styles = resolver();
  assert.equal(listType(styles, 'Nums'), 'ordered');
  assert.equal(listType(styles, 'Dots'), 'bullet');
  assert.equal(listType(styles, 'unknown'), 'bullet');
});

test('survives parent-style cycles and resolves every member once', () => {
  const xml = stylesDocument({
    styles: `
      <style:style style:name="A" style:family="paragraph" style:parent-style-name="B">
        <style:text-properties fo:color="#aa0000"/>
      </style:style>
      <style:style style:name="B" style:family="paragraph" style:parent-style-name="A">
        <style:text-properties fo:font-size="10pt"/>
      </style:style>`,
  });
  const styles = new StyleResolver().addStylesDoc(parseXML(xml, 'styles.xml'));
  const css = styles.resolve('A');

  assert.equal(css.color, '#aa0000');
  assert.equal(css['font-size'], '10pt');
});

test('merges property containers and maps alignment, breaks and scripts', () => {
  const xml = stylesDocument({
    styles: `
      <style:style style:name="Mix" style:family="paragraph">
        <style:paragraph-properties fo:text-align="end" fo:break-before="page" fo:margin="1cm"/>
        <style:text-properties fo:font-weight="bold" style:text-underline-type="single"
          style:text-position="super 58%" fo:background-color="#eeeeee"/>
      </style:style>
      <style:style style:name="Struck" style:family="text">
        <style:text-properties style:text-line-through-style="solid" style:text-position="sub 58%"/>
      </style:style>`,
  });
  const styles = new StyleResolver().addStylesDoc(parseXML(xml, 'styles.xml'));

  const mix = styles.resolve('Mix');
  assert.equal(mix['text-align'], 'right');
  assert.equal(mix['page-break-before'], 'always');
  assert.equal(mix.margin, '1cm');
  assert.equal(mix['font-weight'], 'bold');
  assert.equal(mix['text-decoration'], 'underline');
  assert.equal(mix['vertical-align'], 'super');
  assert.equal(mix['background-color'], '#eeeeee');

  const struck = styles.resolve('Struck');
  assert.equal(struck['text-decoration'], 'line-through');
  assert.equal(struck['vertical-align'], 'sub');
  assert.match(styles.css('Mix'), /font-weight:bold/);
});

test('maps no-fill backgrounds and draw alignment', () => {
  const xml = stylesDocument({
    styles: `
      <style:style style:name="NoFill" style:family="graphic">
        <style:graphic-properties draw:fill="none" draw:align="center"/>
      </style:style>
      <style:style style:name="Start" style:family="paragraph">
        <style:paragraph-properties fo:text-align="start"/>
      </style:style>`,
  });
  const styles = new StyleResolver().addStylesDoc(parseXML(xml, 'styles.xml'));

  const box = styles.resolve('NoFill');
  assert.equal(box['background-color'], 'transparent');
  assert.equal(box['margin-left'], 'auto');
  assert.equal(box['margin-right'], 'auto');
  assert.equal(styles.resolve('Start')['text-align'], 'left');
});

test('applies page margin shorthand and explicit orientation', () => {
  const xml = stylesDocument({
    automaticStyles: `
      <style:page-layout style:name="letter">
        <style:page-layout-properties fo:page-width="8.5in" fo:page-height="11in"
          fo:margin="1.5cm" style:print-orientation="landscape"
          fo:background-color="#fdfdfd"/>
      </style:page-layout>`,
  });
  const doc = parseXML(xml, 'styles.xml');
  const styles = new StyleResolver().addStylesDoc(doc);
  addLayoutStyles(styles, doc);
  const page = pageLayout(styles, 'letter');

  assert.equal(page.marginTop, '1.5cm');
  assert.equal(page.marginRight, '1.5cm');
  assert.equal(page.marginBottom, '1.5cm');
  assert.equal(page.marginLeft, '1.5cm');
  assert.equal(page.orientation, 'landscape');
  assert.equal(page.background, '#fdfdfd');
});

test('returns empty declarations for unknown or absent styles', () => {
  const styles = resolver();
  assert.deepEqual(styles.resolve('NotThere'), {});
  assert.deepEqual(styles.resolve(''), {});
  assert.equal(styles.css('NotThere'), '');
  assert.equal(toCss({}), '');
  assert.equal(styles.addStylesDoc(null), styles);
  assert.deepEqual(pageLayout(styles), pageLayout(styles, 'pm1'));
});

test('exposes an empty master-page style when none is defined', () => {
  const styles = resolver();
  assert.equal(masterPage(styles, 'Missing'), null);
  assert.equal(pageLayoutForMaster(styles, 'Missing').width, '21cm');
});
