# Bundled font licenses

This directory bundles latin-subset woff2 webfonts under three licenses:
the **SIL Open Font License 1.1** (full text at the bottom of this file;
copyright notices and "Reserved Font Names" reproduced per family, as the
OFL requires), the **Apache License 2.0** (full text in `Apache-2.0.txt`),
and the **DejaVu / Bitstream Vera license** (full text in `DejaVu-License.txt`).
All families were obtained from the Fontsource CDN (jsdelivr / npm
`@fontsource/<name>`).

Two groups of fonts live here:

1. **Readability fonts** — Atkinson Hyperlegible, Lexend, OpenDyslexic.
   Regular + bold only; the browser synthesizes italics.

2. **Metric-compatible substitutes** for the proprietary / system fonts the
   picker offers but which can't be shipped — regular, bold, italic, and
   bold-italic each. `style.css` declares each one under the *proprietary*
   family name with a `local()` fallback, so a user who actually has the real
   font keeps it and everyone else gets the open-source clone:

   | Picker font(s) | Bundled clone | License |
   | --- | --- | --- |
   | Calibri | Carlito | OFL 1.1 |
   | Cambria | Caladea | OFL 1.1 |
   | Times New Roman, Liberation Serif | Tinos | OFL 1.1 |
   | Arial, Helvetica, Liberation Sans | Arimo | Apache 2.0 |
   | Georgia | Gelasio | OFL 1.1 |
   | Comic Sans MS | Comic Neue | OFL 1.1 |
   | Verdana, Tahoma, DejaVu Sans | DejaVu Sans | DejaVu / Bitstream Vera |
   | DejaVu Serif | DejaVu Serif | DejaVu / Bitstream Vera |
   | Noto Sans / Noto Serif | Noto Sans / Noto Serif | OFL 1.1 |

Each substitute ships four files: `<name>-{400,700,400-italic,700-italic}.woff2`.

## Atkinson Hyperlegible

- Source: https://github.com/googlefonts/atkinson-hyperlegible
- Files: `atkinson-hyperlegible-400.woff2`, `atkinson-hyperlegible-700.woff2`

Copyright (c) 2020, Braille Institute of America, Inc.,
https://www.brailleinstitute.org, with Reserved Font Name
"Atkinson Hyperlegible".

## Lexend

- Source: https://github.com/googlefonts/lexend
- Files: `lexend-400.woff2`, `lexend-700.woff2`

Copyright (c) 2018-2020, The Lexend Project Authors
(https://github.com/googlefonts/lexend), with Reserved Font Name
"Lexend".

## OpenDyslexic

- Source: https://github.com/antijingoist/opendyslexic
- Files: `opendyslexic-400.woff2`, `opendyslexic-700.woff2`

Copyright (c) 2019-2020, Abelardo Gonzalez
(abbiecod.es@gmail.com), with Reserved Font Name "OpenDyslexic".

## Carlito (substitutes for Calibri) — OFL 1.1

Copyright 2013 The Carlito Project Authors
(https://github.com/googlefonts/carlito), with Reserved Font Name "Carlito".

## Caladea (substitutes for Cambria) — OFL 1.1

Copyright 2012 The Caladea Project Authors
(https://github.com/huertatipografica/Caladea), with Reserved Font Name
"Caladea".

## Tinos (substitutes for Times New Roman / Liberation Serif) — OFL 1.1

Copyright Google Inc., with Reserved Font Name "Tinos".

## Gelasio (substitutes for Georgia) — OFL 1.1

Copyright 2022 The Gelasio Project Authors
(https://github.com/SorkinType/Gelasio), with Reserved Font Name "Gelasio".

## Comic Neue (substitutes for Comic Sans MS) — OFL 1.1

Copyright 2014 The Comic Neue Project Authors
(https://github.com/crozynski/comicneue), with Reserved Font Name "Comic Neue".

## Noto Sans / Noto Serif — OFL 1.1

Copyright 2022 The Noto Project Authors
(https://github.com/notofonts/latin-greek-cyrillic), with Reserved Font Names
"Noto Sans" and "Noto Serif".

## Arimo (substitutes for Arial / Helvetica / Liberation Sans) — Apache 2.0

Digitized data copyright Google Inc. Licensed under the Apache License,
Version 2.0 — full text in `Apache-2.0.txt`.

## DejaVu Sans / DejaVu Serif (substitutes for Verdana / Tahoma, and themselves)

DejaVu fonts: the Bitstream Vera Fonts Copyright (c) 2003 by Bitstream, Inc.,
with DejaVu changes in the public domain. Full text in `DejaVu-License.txt`.

## SIL Open Font License, Version 1.1

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
