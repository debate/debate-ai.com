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
