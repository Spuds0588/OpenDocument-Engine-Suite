# Real-world fixtures

Documents written by real office suites, kept so the parsers are checked against
producer output and not only against the containers built in memory by
`test/helpers/odf.js`. Those synthetic builders stay the primary fixtures;
`test/integration.test.js` and the browser suite read this directory.

All five files come from the Apache-2.0 licensed ODF Toolkit repository
([tdf/odftoolkit](https://github.com/tdf/odftoolkit),
`odfdom/src/test/resources/test-input/`), so they can be redistributed here
under that license. They are byte-for-byte copies; only the names are kept.

| File | Size | Producer (`meta:generator`) | What it covers |
| --- | --- | --- | --- |
| `character-styles.odt` | 13 KB | `LibreOffice/6.1.6.3$Windows_X86_64` | 12 headings, character styles, no tables |
| `compdocfileformat.odt` | 55 KB | `StarOffice/8$Win32` | 21 tables, 29 lists, row spans, an embedded image, a document title |
| `default_namespace.ods` | 28 KB | `Cedaron.FormBuilder.Presentation` (third party) | 19 sheets, default XML namespace, floats, booleans and dates |
| `XPathTest-foreignPrefix.odp` | 12 KB | `OpenOffice.org/3.2$Unix` | non-standard namespace prefixes (`daisy`, `prefixOne`, `prefixTwo`), speaker notes |
| `presentationWithEmbedDoc.odp` | 19 KB | `OpenOffice.org/3.0$Win32` | embedded chart objects, empty `<draw:text-box/>` frames, image targets that are absent from the archive |

SHA-256:

```
6b96d690822330ca0ce0632163dd3269d7f551890510131bf688fa6a05c3dca6  character-styles.odt
a74407595f8461961a98e88346142c72685587f6e373167c98778a9e362f6407  compdocfileformat.odt
f9a8dc2170ef476fbec3f0386b58836e91149f90e03f0a497ec98256a70fa1d0  default_namespace.ods
33a34765258a24d1f7ce454d96b8a3bee756ff8e47840fefc2fe5f4b6ef07398  presentationWithEmbedDoc.odp
4dc061ee0d08abfb84116cb3ddbe19b48127352818890e311d81de3d22ca354c  XPathTest-foreignPrefix.odp
```

Do not edit these files. Add a new copy instead, with its source and checksum
recorded here.
