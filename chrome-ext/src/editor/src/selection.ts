import type { ParaType, RunType } from './types';
export function getSelectionNode(parasElement: HTMLElement, items: ParaType[]) {
  const selection = window.getSelection();
  const itemsElement = parasElement.querySelector('.items');
  if (!(selection.rangeCount && selection.containsNode(parasElement, true)))
    return undefined;
  const range = selection.getRangeAt(0);
  let selectPos = {
    start: {
      para: undefined,
      run: undefined,
      offset: undefined,
    },
    end: {
      para: undefined,
      run: undefined,
      offset: undefined,
    },
  };
  let paraIndex = 0;
  for (let para of itemsElement.children) {
    if (para.contains(range.startContainer)) {
      // find out which run its in
      let runIndex = 0;
      for (let run of para.querySelector('.para').children) {
        if (run.contains(range.startContainer)) {
          // find character index in run of the startOffset
          let charIndex = 0;
          for (let node of run.childNodes) {
            // add it to selectPos
            if (
              node == range.startContainer ||
              node.contains(range.startContainer)
            ) {
              selectPos.start.para = paraIndex;
              selectPos.start.run = runIndex;
              selectPos.start.offset = charIndex + range.startOffset;
              break;
            }
            charIndex += node.textContent.length;
          }
        }
        runIndex++;
      }
    }
    if (para.contains(range.endContainer)) {
      // find out which run its in
      let runIndex = 0;
      // check if selection is in para
      let isInRun = false;
      for (let run of para.querySelector('.para').children) {
        if (run.contains(range.endContainer)) {
          isInRun = true;
          // find character index in run of the startOffset
          let charIndex = 0;
          for (let node of run.childNodes) {
            // add it to selectPos
            if (
              node == range.endContainer ||
              node.contains(range.endContainer)
            ) {
              selectPos.end.para = paraIndex;
              selectPos.end.run = runIndex;
              selectPos.end.offset = charIndex + range.endOffset;
              break;
            }
            charIndex += node.textContent.length;
          }
        }
        // if not in run, just set offset to first run
        if (!isInRun) {
          selectPos.end.para = paraIndex;
          selectPos.end.run = 0;
          selectPos.end.offset = 0;
        }
        runIndex++;
      }
    }
    paraIndex++;
  }
  // if no end, just set to last item
  if (selectPos.end.para == null) {
    selectPos.end.para = items.length - 1;
    selectPos.end.run = items[selectPos.end.para].runs.length - 1;
    selectPos.end.offset =
      items[selectPos.end.para].runs[selectPos.end.run].text.length;
  }
  console.log(selectPos);
  let ret = document.createElement('div');
  for (let i = selectPos.start.para; i < selectPos.end.para + 1; i++) {
    let para = items[i];
    let paraNode: HTMLElement;
    if (i == selectPos.start.para && i == selectPos.end.para) {
      paraNode = getParaHTML(
        para,
        selectPos.start.run,
        selectPos.end.run,
        selectPos.start.offset,
        selectPos.end.offset
      );
    } else if (i == selectPos.start.para) {
      paraNode = getParaHTML(
        para,
        selectPos.start.run,
        null,
        selectPos.start.offset,
        null
      );
    } else if (i == selectPos.end.para) {
      paraNode = getParaHTML(
        para,
        null,
        selectPos.end.run,
        null,
        selectPos.end.offset
      );
    } else {
      paraNode = getParaHTML(para);
    }
    ret.appendChild(paraNode);
  }
  return ret;
}

export function getParaHTML(
  para: ParaType,
  runStart?: number,
  runEnd?: number,
  offsetStart?: number,
  offsetEnd?: number
) {
  let elementType = 'p';
  if (para.outline_level === 0) {
    elementType = 'h1';
  } else if (para.outline_level === 1) {
    elementType = 'h2';
  } else if (para.outline_level === 2) {
    elementType = 'h3';
  } else if (para.outline_level === 3) {
    elementType = 'h4';
  } else if (para.outline_level === 4) {
    elementType = 'h5';
  } else if (para.outline_level === 5) {
    elementType = 'h6';
  }
  let paraNode = document.createElement(elementType);
  paraNode.setAttribute(
    'style',
    `
    font-family: Calibri;
    line-height: 1em;
  `
  );
  let runs: RunType[] = para.runs;
  runStart = runStart ?? 0;
  runEnd = runEnd ?? runs.length - 1;
  for (let i = runStart; i < runEnd + 1; i++) {
    if (i == runStart && i == runEnd) {
      paraNode.appendChild(getRunHTML(runs[i], offsetStart, offsetEnd));
    } else if (i == runStart) {
      paraNode.appendChild(getRunHTML(runs[i], offsetStart, null));
    } else if (i == runEnd) {
      paraNode.appendChild(getRunHTML(runs[i], null, offsetEnd));
    } else {
      paraNode.appendChild(getRunHTML(runs[i]));
    }
  }
  return paraNode;
}
function getRunHTML(run: RunType, offsetStart?: number, offsetEnd?: number) {
  let runNode = document.createElement('span');
  runNode.setAttribute(
    'style',
    `
      font-weight: ${run.style.bold ? 'bold' : 'normal'};
      text-decoration: ${run.style.underline ? 'underline' : 'none'};
      font-size: ${run.style.size ? run.style.size / 2 : 12}pt;
      background-color: ${run.style.highlight ? 'yellow' : 'none'};
    `
  );
  offsetStart = offsetStart ?? 0;
  offsetEnd = offsetEnd ?? run.text.length;
  let text = run.text.slice(offsetStart, offsetEnd);

  runNode.innerText = text.replace(/\n/g, '').replace(/\r/g, '');
  return runNode;
}
export function copyToClipboard(html: HTMLElement) {
  let HTMLBlob = new Blob([html.innerHTML], { type: 'text/html' });
  // add newlines between paragraphs for raw text
  for (let child of html.children) {
    child.appendChild(document.createTextNode('\n'));
  }
  let textBlob = new Blob([html.textContent], { type: 'text/plain' });
  const clipboardItem = new window.ClipboardItem({
    'text/html': HTMLBlob,
    'text/plain': textBlob,
  });
  navigator.clipboard.write([clipboardItem]);
}
