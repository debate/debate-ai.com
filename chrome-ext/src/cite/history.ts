import type { ICard, IPara, IRun } from './types';
import type { Writable } from 'svelte/store';
import { messenger } from './stores';


export type IStorage = {
  count: number;
};
export type ICard = {
  tag: string;
  title: string;
  authors: {
    name: string;
    isPerson: boolean;
    description: string | null;
    id: number;
  }[];
  date: {
    month: string;
    day: string;
    year: string;
  };
  url: string;
  paras: IPara[];
  siteName: string;
  accessDate: {
    month: string;
    day: string;
    year: string;
  };
};
export type IPara = IRun[];
export type IRun = {
  text: string;
  underline: boolean;
  highlight: boolean;
};

export type ITooltipInfo = {
  content?: string;
  disabled?: boolean;
  layout?: string;
  exist?: boolean;
};
export type IFormatter = {
  key: string;
  format: (card: ICard) => string | null;
};

export type IMessage = {
  text: string;
  id: number;
  error: boolean;
};

export type IPopupKeys = 'login' | 'upload';


type Action = {
  name: string;
  undoData: any;
  redoData: any;
  canExtend: boolean;
};

function deepClone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

let actionLabels = {
  text: ' text edit',
  addAuthor: ' author addition',
  deleteAuthor: ' author deletion',
  editAuthor: ' author edit',
  editDate: ' date edit',
  editPara: ' paragraph edit',
  condenseParas: ' paragraph condensation',
  autoCutParas: ' auto-cut',
};
export class EditHistory {
  history: Action[];
  card: Writable<ICard>;
  $card: ICard;
  authorIdCounter: number;
  // pos is how far back in history you are
  pos: number;
  constructor(card: Writable<ICard>) {
    this.history = [];
    this.card = card;
    this.$card;
    this.pos = 0;
    this.card.subscribe((newCard: ICard) => {
      this.$card = newCard;
      if (this.authorIdCounter == null) {
        this.authorIdCounter = this.$card?.authors?.length - 1;
      }
    });
    this.authorIdCounter = null;
  }
  doAction(name: string, data?: any) {
    let historyData: any;
    switch (name) {
      case 'text':
        historyData = {
          key: data.key,
          oldText: this.$card[data.key],
        };
        this.$card[data.key] = data.text;
        break;
      case 'addAuthor':
        historyData = {};
        this.authorIdCounter += 1;
        this.$card['authors'].push({
          name: '',
          isPerson: true,
          description: null,
          id: this.authorIdCounter,
        });
        break;
      case 'deleteAuthor':
        historyData = {
          deletedAuthor: { ...this.$card['authors'][data.index] },
        };
        this.$card['authors'].splice(data.index, 1);
        break;
      case 'editAuthor':
        historyData = {
          index: data.index,
          oldAuthor: { ...this.$card['authors'][data.index] },
        };
        this.$card['authors'][data.index] = data.author;
        break;
      case 'editDate':
        historyData = {
          key: data.key,
          oldDate: { ...this.$card[data.key] },
        };
        this.$card[data.key] = data.date;
        break;
      case 'editPara':
        historyData = this.editParas(data);
        break;
      case 'condenseParas':
        historyData = this.condenseParas();
        break;
      case 'autoCutParas':
        historyData = { oldParas: deepClone(this.$card.paras) };
        this.$card.paras = data;
    }
    return historyData;
  }
  action(name: string, data?: any) {
    let historyData = this.doAction(name, data);
    this.card.set(this.$card);
    this.history.push({
      name: name,
      undoData: historyData,
      redoData: data,
      canExtend: true,
    });
    // extend history elements (combining consecutive text edits)
    if (this.history.length >= 2) {
      let lastAction = this.history[this.history.length - 2];
      if (lastAction.canExtend && lastAction.name == name) {
        switch (name) {
          case 'text':
            this.history.pop();
            break;
          case 'editAuthor':
            this.history.pop();
            break;
          case 'editDate':
            this.history.pop();
          default:
            // no extension was achieved, so just prevent extending on lastAction
            lastAction.canExtend = false;
        }
      }
    }
    if (this.pos != 0) {
      this.history.splice(this.history.length - this.pos);
      this.pos = 0;
    }
  }
  preventExtension() {
    if (this.history.length > 0) {
      this.history[this.history.length - 1].canExtend = false;
    }
  }
  undo() {
    if (this.history.length == 0) return;
    this.pos += 1;
    if (this.pos > this.history.length) {
      this.pos = this.history.length;
      return;
    }
    let action = this.history[this.history.length - this.pos];

    let data = action.undoData;
    switch (action.name) {
      case 'text':
        this.$card[data.key] = data.oldText;
        break;
      case 'addAuthor':
        this.$card['authors'].pop();
        break;
      case 'deleteAuthor':
        this.$card['authors'].splice(data.index, 0, data.deletedAuthor);
        break;
      case 'editAuthor':
        this.$card['authors'][data.index] = { ...data.oldAuthor };
        break;
      case 'editDate':
        this.$card[data.key] = data.oldDate;
        break;
      case 'editPara':
        this.uneditParas(data);
        break;
      case 'condenseParas':
        this.uncondenseParas(data);
        break;
      case 'autoCutParas':
        this.$card.paras = data.oldParas;
        break;
    }
    messenger.addMessage('Undid ' + actionLabels[action.name]);
    this.card.set(this.$card);
  }
  redo() {
    if (this.history.length == 0) return;
    let action = this.history[this.history.length - this.pos];
    this.pos -= 1;
    if (this.pos < 0) {
      this.pos = 0;
      return;
    }
    let data = action.redoData;
    this.doAction(action.name, data);
    messenger.addMessage('Redid ' + actionLabels[action.name]);
    this.card.set(this.$card);
  }
  getChangeRunIndexes(
    paras: IPara[],
    index: {
      startP: number;
      endP: number;
      startSpan: number;
      endSpan: number;
      startOffset: number;
      endOffset: number;
    }
  ) {
    const startP = index.startP;
    const endP = index.endP;
    const startSpan = index.startSpan;
    // must be let because will be changed as spans increase
    let endSpan = index.endSpan;
    const startOffset = index.startOffset;
    const endOffset = index.endOffset;

    let changeRunIndexes: [number, number][] = [];

    // if highlight start and highlight end are in the same run
    if (startP == endP && startSpan == endSpan) {
      let run = paras[startP][startSpan];
      let run1 = { ...run };
      let run2 = { ...run };
      let run3 = { ...run };
      run1.text = run.text.slice(0, startOffset);
      run2.text = run.text.slice(startOffset, endOffset);
      run3.text = run.text.slice(endOffset);
      changeRunIndexes.push([startP, startSpan + 1]);
      paras[startP] = [
        ...paras[startP].slice(0, startSpan),
        run1,
        run2,
        run3,
        ...paras[startP].slice(startSpan + 1),
      ];
    }
    // else do them individually
    else {
      // highlight start
      let run = paras[startP][startSpan];
      let run1 = { ...run };
      let run2 = { ...run };
      run1.text = run.text.slice(0, startOffset);
      run2.text = run.text.slice(startOffset);
      changeRunIndexes.push([startP, startSpan + 1]);
      paras[startP] = [
        ...paras[startP].slice(0, startSpan),
        run1,
        run2,
        ...paras[startP].slice(startSpan + 1),
      ];
      // if both spans are in the same para, increase endSpan by 1
      if (startP == endP) {
        endSpan += 1;
      }
      // highlight middle
      for (let i = startP; i < endP + 1; i++) {
        for (let j = 0; j < paras[i].length; j++) {
          if (i == startP && j < startSpan + 2) continue;
          if (i == endP && j > endSpan - 1) continue;
          changeRunIndexes.push([i, j]);
        }
      }
      // highlight end
      run = paras[endP][endSpan];
      run1 = { ...run };
      run2 = { ...run };
      run1.text = run.text.slice(0, endOffset);
      run2.text = run.text.slice(endOffset);
      changeRunIndexes.push([endP, endSpan]);

      paras[endP] = [
        ...paras[endP].slice(0, endSpan),
        run1,
        run2,
        ...paras[endP].slice(endSpan + 1),
      ];
      // increase endSpan by 1
      endSpan += 1;
    }
    return changeRunIndexes;
  }
  editParas(data: {
    tool: null | 'highlight' | 'underline' | 'eraser';
    index: {
      startP: number;
      endP: number;
      startSpan: number;
      endSpan: number;
      startOffset: number;
      endOffset: number;
    };
  }) {
    let tool = data.tool;

    let newParas = [...this.$card.paras];
    let changeRunIndexes: [number, number][] = this.getChangeRunIndexes(
      newParas,
      data.index
    );

    // check if all the runs are already highlighted
    let allHighlighted = true;
    for (let [i, j] of changeRunIndexes) {
      if (!newParas[i][j][tool]) {
        allHighlighted = false;
      }
    }
    let changedRuns: {
      format: {
        highlight: boolean;
        underline: boolean;
      };
      paraIndex: number;
      startOffset: number;
      endOffset: number;
    }[] = [];
    for (let [i, j] of changeRunIndexes) {
      // add to history
      // get startOffset
      let startOffset = 0;
      for (let k = 0; k < j; k++) {
        startOffset += newParas[i][k].text.length;
      }
      changedRuns.push({
        format: {
          highlight: newParas[i][j].highlight,
          underline: newParas[i][j].underline,
        },
        paraIndex: i,
        startOffset: startOffset,
        endOffset: startOffset + newParas[i][j].text.length,
      });
      // if tool is eraser unhighlight all
      if (tool == 'eraser') {
        newParas[i][j].underline = false;
        newParas[i][j].highlight = false;
      }
      // if all highlighted, unhighlight
      else if (allHighlighted) {
        newParas[i][j][tool] = false;
      }
      // else highlight
      else {
        newParas[i][j][tool] = true;
      }
    }
    this.$card.paras = newParas;
    this.combineRuns();
    return { changedRuns };
  }
  uneditParas(data: {
    changedRuns: {
      format: {
        highlight: boolean;
        underline: boolean;
      };
      paraIndex: number;
      startOffset: number;
      endOffset: number;
    }[];
  }) {
    let newParas = [...this.$card.paras];
    for (let run of data.changedRuns) {
      let paraIndex = run.paraIndex;
      let para = newParas[paraIndex];
      // get startSpan and startOffset
      let startSpan = 0;
      let startOffset = run.startOffset;
      while (startOffset > para[startSpan].text.length) {
        startOffset -= para[startSpan].text.length;
        startSpan += 1;
      }
      // get endSpan and endOffset
      let endSpan = 0;
      let endOffset = run.endOffset;
      while (endOffset > para[endSpan].text.length) {
        endOffset -= para[endSpan].text.length;
        endSpan += 1;
      }

      let index = {
        startP: paraIndex,
        endP: paraIndex,
        startSpan: startSpan,
        endSpan: endSpan,
        startOffset: startOffset,
        endOffset: endOffset,
      };
      let changeRunIndexes = this.getChangeRunIndexes(newParas, index);
      for (let [i, j] of changeRunIndexes) {
        newParas[i][j].underline = run.format.underline;
        newParas[i][j].highlight = run.format.highlight;
      }
    }
    this.$card.paras = newParas;
    this.combineRuns();
  }

  combineRuns() {
    this.$card.paras = this.$card.paras.map(function (para) {
      let newPara: IPara = [];
      if (para.length == 0) return [];
      let prevRun = { ...para[0] };
      for (let i = 1; i < para.length; i++) {
        let run = para[i];
        if (run.text.length == 0) {
          continue;
        }
        if (
          run.highlight == prevRun.highlight &&
          run.underline == prevRun.underline
        ) {
          prevRun.text = prevRun.text.concat(run.text);
        } else {
          newPara.push({ ...prevRun });
          prevRun = { ...run };
        }
      }
      newPara.push({ ...prevRun });
      return newPara;
    });
  }
  condenseParas() {
    // combine all paras into one
    let finalPara: IPara = [];

    let charIndex = 0;
    let chopPoints: number[] = [];

    for (let para of this.$card.paras) {
      if (para.length > 0) {
        // it is guarenteed that they are trimmed by content script, so extra spaces are not a problem
        para[para.length - 1].text += ' ';
        // get para char length to remember where paras were split
        let paraCharLength = para.reduce(function (prev, current) {
          return prev + current.text.length;
        }, 0);

        charIndex += paraCharLength;
        chopPoints.push(charIndex);
        finalPara = [...finalPara, ...para];
      }
    }
    this.$card.paras = [finalPara];
    this.combineRuns();
    return { chopPoints };
  }
  uncondenseParas(data: { chopPoints: number[] }) {
    if (this.$card.paras.length > 1) {
      return;
    }
    // first, chop runs back into pieces that line up with para barriers
    let newPara: IPara = [];
    let charIndex = 0;
    let chopPoints = data.chopPoints;
    let chopIndex = 0;
    for (let run of this.$card.paras[0]) {
      charIndex += run.text.length;
      // add run to end of newPara
      newPara.push(run);
      while (chopPoints[chopIndex] < charIndex) {
        let chop = chopPoints[chopIndex];
        let run = newPara[newPara.length - 1];
        let run1 = { ...run };
        let run2 = { ...run };
        run1.text = run1.text.slice(0, chop - charIndex);
        run2.text = run2.text.slice(chop - charIndex);
        newPara[newPara.length - 1] = { ...run1 };
        newPara.push({ ...run2 });
        chopIndex += 1;
      }
    }
    let newParas: IPara[] = [];
    let para: IPara = [];
    charIndex = 0;
    chopPoints = data.chopPoints;
    chopIndex = 0;
    // then, sort runs into their correct paras
    for (let run of newPara) {
      charIndex += run.text.length;
      para.push(run);
      if (chopPoints[chopIndex] == charIndex) {
        // remove extra space at the end of last run
        para[para.length - 1].text = para[para.length - 1].text.slice(
          0,
          para[para.length - 1].text.length - 1
        );
        newParas.push(para);
        chopIndex += 1;
        para = [];
      }
    }
    this.$card.paras = newParas;
  }
}
