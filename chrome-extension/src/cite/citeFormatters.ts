import type { ICard, IFormatter } from './types';
// if (date instanceof Date && !isNaN(date.valueOf())) {

export function validateDate(date: {
  month: string;
  day: string;
  year: string;
}) {
  let month = date.month;
  let day = date.day;
  let year = date.year;
  let validMonth =
    month != undefined &&
    month.length != 0 &&
    !isNaN(parseInt(month)) &&
    parseInt(month) >= 1 &&
    parseInt(month) <= 12 &&
    month.length <= 2 &&
    month.length >= 1;

  let validDay =
    day != undefined &&
    day.length != 0 &&
    !isNaN(parseInt(day)) &&
    parseInt(day) >= 1 &&
    parseInt(day) <= 31 &&
    day.length <= 2 &&
    day.length >= 1;
  let validYear =
    year != undefined &&
    year.length != 0 &&
    !isNaN(parseInt(year)) &&
    year.length > 2;
  return { month: validMonth, day: validDay, year: validYear };
}
export function validateText(text: string) {
  return text != undefined && text.length != 0;
}
export function validateAuthors(
  authors: {
    name: string;
    isPerson: boolean;
    description: string | null;
  }[]
) {
  return authors.length > 0 && authors[0].name.length > 0;
}

export let formatters: { [key: string]: IFormatter } = {
  bigAuthors: {
    key: 'authors',
    format: function (card: ICard) {
      let ret: string | null = null;
      if (
        card.authors.length > 0 &&
        card.authors.filter((author) => author.name.length > 0).length > 0
      ) {
        const mainAuthor = card.authors[0];
        if (mainAuthor.isPerson) {
          // get last name
          ret = mainAuthor.name.split(' ').pop() ?? null;
        } else {
          ret = `${mainAuthor.name}`;
        }
      }
      return ret;
    },
  },
  bigDate: {
    key: 'date',
    format: function (card: ICard) {
      let ret: string | null = null;
      let valid = validateDate(card.date);
      if (!(valid.month && valid.day && valid.year)) {
        return ret;
      }

      const date = new Date(
        parseInt(card.date.year),
        parseInt(card.date.month) - 1,
        parseInt(card.date.day)
      );
      const currentDate = new Date();

      
      //swap year with M/D if its the same year
      const DEBATE_SWAP_YEAR = false;
      /*
      if (DEBATE_SWAP_YEAR)
      if (currentDate.getFullYear() == date.getFullYear()) {
        ret = `${date.getMonth() + 1}/${date.getDate()}`;
      } else {
        // if its more than 100 years old (yes this code will be used in 100 years)
        let fullYear = `${date.getFullYear()}`;
        if (currentDate.getFullYear() - date.getFullYear() > 100) {
          ret = fullYear;
        } else {
          // get last two chars
          // ret = `'${fullYear.slice(fullYear.length - 2)}`;
        }
      }*/
      let fullYear = date.getFullYear();

      
      return fullYear;
    },
  },
  date: {
    key: 'date',
    format: function (card: ICard) {
      let ret: string | null = null;
      let valid = validateDate(card.date);
      if (!(valid.month && valid.day && valid.year)) {
        return ret;
      }

      const date = new Date(
        parseInt(card.date.year),
        parseInt(card.date.month) - 1,
        parseInt(card.date.day)
      );


      ret = date.getDate() + " " +  
        date.toLocaleString('en-us',{month:'short'}) + 
        " " + date.getFullYear();

      return ret;
    },
  },
  accessDate: {
    key: 'accessDate',
    format: function (card: ICard) {
      let ret: string | null = null;
      let valid = validateDate(card.accessDate);
      if (!(valid.month && valid.day && valid.year)) {
        return ret;
      }
      const date = new Date(
        parseInt(card.accessDate.year),
        parseInt(card.accessDate.month) - 1,
        parseInt(card.accessDate.day)
      );
      if (date instanceof Date && !isNaN(date.valueOf())) {
        ret = "Accessed " + date.getDate() + " " +  
        date.toLocaleString('en-us',{month:'short'}) + 
        " " + date.getFullYear();
      }
      return ret;
    },
  },
  authors: {
    key: 'authors',
    format: function (card: ICard) {
      // if card.authors isnt null
      let ret: string | null = null;
      if (
        card.authors.length > 0 &&
        card.authors.filter((author) => author.name.length > 0).length > 0
      ) {
        ret = card.authors.map((author) => author.name).join(', ');
      }
      return ret;
    },
  },
  title: {
    key: 'title',
    format: function (card: ICard) {
      let ret: string | null = null;
      if (validateText(card.title)) {
        ret = card.title;
      }
      return ret;
    },
  },
  siteName: {
    key: 'siteName',
    format: function (card: ICard) {
      let ret: string | null = null;
      if (validateText(card.siteName)) {
        ret = card.siteName;
      }
      return ret;
    },
  },
  url: {
    key: 'url',
    format: function (card: ICard) {
      let ret: string | null = null;
      if (validateText(card.url)) {
        ret = card.url;
      }
      return ret;
    },
  },
};
