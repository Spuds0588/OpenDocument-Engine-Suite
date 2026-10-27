/**
 * Shared benchmark documents: roughly 5 MB of XML per engine.
 *
 * Kept environment-neutral (plain strings only) so the Node benchmark and the
 * browser benchmark measure exactly the same input.
 */

export const TARGET_BYTES = 5 * 1024 * 1024;
export const TARGET_MS = 150;

function fill(unit, size = TARGET_BYTES) {
  let body = '';
  let index = 0;
  while (body.length < size) body += unit(index++);
  return body;
}

const odtBody = fill((index) =>
  `<text:p text:style-name="Standard">Paragraph ${index}: Lorem ipsum dolor sit amet, `
  + 'consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</text:p>');

const odsRows = fill((index) =>
  `<table:table-row>`
  + `<table:table-cell office:value-type="string"><text:p>Row ${index}</text:p></table:table-cell>`
  + '<table:table-cell office:value-type="float" office:value="42"><text:p>42</text:p></table:table-cell>'
  + '<table:table-cell office:value-type="string"><text:p>Alpha beta gamma delta epsilon zeta</text:p></table:table-cell>'
  + '<table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>'
  + '<table:table-cell office:value-type="string"><text:p>Tail cell</text:p></table:table-cell>'
  + '</table:table-row>', 4 * 1024 * 1024);

const odpSlides = fill((index) =>
  `<draw:page draw:name="Slide ${index}" draw:master-page-name="Standard">`
  + '<draw:frame svg:x="1cm" svg:y="1cm" svg:width="20cm" svg:height="4cm">'
  + `<draw:text-box><text:p>Slide ${index} title</text:p>`
  + '<text:list><text:list-item><text:p>First bullet point for the slide</text:p></text:list-item>'
  + '<text:list-item><text:p>Second bullet point for the slide</text:p></text:list-item></text:list>'
  + '</draw:text-box></draw:frame></draw:page>', 4 * 1024 * 1024);

export const odtXml = `<office:text>${odtBody}</office:text>`;
export const odsXml = `<office:spreadsheet><table:table table:name="Bench">${odsRows}</table:table></office:spreadsheet>`;
export const odpXml = `<office:presentation>${odpSlides}</office:presentation>`;
