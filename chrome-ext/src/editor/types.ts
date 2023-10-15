export type StyleType = {
  bold: boolean;
  underline: boolean;
  highlight: boolean;
  size: number;
  outline_level: number;
};
export type RunType = {
  text: string;
  style: StyleType;
};

export type ParaType = {
  runs: RunType[];
  outline_level: number;
  index?: number;
};
export type DocumentType = {
  paras: ParaType[];
};
export type OutlineParaType = {
  level: number;
  para: ParaType;
  index: number;
  link: number;
};
export type SearchResultType = {
  text: string;
  index: number;
  query_index: number;
};

export type LoaderState = {
  startIndex: number;
  endIndex: number;
  scrollTop: number;
};
export type Query = {
  text: string;
  matchCase: boolean;
  onlyOutline: boolean;
};

export enum Align {
  Top,
  Bottom,
  Left,
  Right,
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight,
}
