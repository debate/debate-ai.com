export type Run = {
  text: string;
  underline: boolean;
  highlight: boolean;
};

export type Para = Run[];

export type CardDate = {
  month: string;
  day: string;
  year: string;
};

export type CardAuthor = {
  id: string;
  name: string;
  isPerson: boolean;
  description: string | null;
};

export type CardData = {
  id?: string;
  tag: string;
  title: string;
  authors: CardAuthor[];
  date: CardDate | null;
  url: string;
  paras: Para[];
  siteName: string | null;
  accessDate: CardDate;
  isPrivate: boolean;
};
