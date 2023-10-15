## Debate Card Parser

 Converts docx debate file to html with u b i h1 mark tags

```
pnpm i
node .\debate-converter.js "<folder>"
```

### PDF to HTML

Python pdf2docx is the needed as an interim step, because in testing pdf2html.js pdf.js do not preserve markup  and pdf2htmlEX.deb does not preserve highlighting. 

```
pip install pdf2docx
python pdf.py "<folder>"

```