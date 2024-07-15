export const getStyleNameByXml = (elXmlName) => {
  const predicate = ({ xmlName = null }) => elXmlName === xmlName;
  return findKey(styleMap, predicate) ?? "text";
};

export const getOutlineLvlName = (outlineLvl) => {
  const predicate = ({ docxStyles = null }) =>
    outlineLvl === docxStyles?.outlineLevel;
  return findKey(styleMap, predicate) ?? "text";
};

export const getStyles = () => {
  return Object.keys(styleMap);
};

export const getHeadingStyles = () => {
  return Object.keys(styleMap).filter(
    (key) => styleMap[key].heading
  );
};

export const getDocxStyles = (styles) => {
  return Object.keys(styles).reduce((acc, key) => ({
    ...acc,
    ...styleMap[key]?.docxStyles,
  }), {});
};

export const tokensToMarkup = (textBlocks, plainTextOnly = false) => {
  let dom = "";
  const state = { underline: false, strong: false, mark: false };

  textBlocks.forEach(({ format, tokens }) => {
    if (!tokens.length) return;
    const { domElement } = styleMap[format];

    if (!plainTextOnly) 
      dom += `<${domElement}>`;
    tokens.forEach(({ text, format }) => {
      if (!text || text.trim().length < 1) return;
      let tags = "";
      for (const style in state) {
        if (state[style] !== format[style]) {
          const elName = styleMap[style]?.domElement;
          tags += `<${format[style] ? "" : "/"}${elName}>`;
          state[style] = format[style];
        }
      }

      dom += plainTextOnly ? text : tags + text;
    });

    dom += plainTextOnly ? " \n" : `</${domElement}>`;
  });

  if (!plainTextOnly) {
    for (const style in state) {
      if (state[style]) {
        dom += `</${styleMap[style]?.domElement}>`;
      }
    }
  }
  
  return dom.replace(/ \n$/, "");
};

export const simplifyTokens = (block) => {
  const simplifiedTokens = block.tokens.reduce((acc, { format, text }) => {
    if (!acc.length) return [{ format, text }];
    const prev = acc[acc.length - 1];
    const { format: prevFormat, text: prevText } = prev;
    isSameFormat(format, prevFormat)
      ? (prev.text = prevText + text)
      : acc.push({ text, format });
    return acc;
  }, []);
  return { format: block.format, tokens: simplifiedTokens };
};

export const findKey = (object, predicate) => {
  if (object == null) {
    return undefined;
  }
  const keys = Object.keys(object);
  for (let i = 0, { length } = keys; i < length; i += 1) {
    const key = keys[i];
    const value = object[key];
    if (predicate(value, key, object)) {
      return key;
    }
  }
  return undefined;
};

export const isSameFormat = (a, b) =>
  a.mark === b.mark && a.strong === b.strong && a.underline === b.underline;

export const styleMap = {
  pocket: {
    block: true,
    heading: true,
    domSelector: ["h1"],
    domElement: "h1",
    xmlName: "Heading1",
    docxStyles: {
      heading: 1,
      outlineLevel: 1,
    },
  },
  hat: {
    block: true,
    heading: true,
    domSelector: ["h2"],
    domElement: "h2",
    xmlName: "Heading2",
    docxStyles: {
      heading: 2,
      outlineLevel: 2,
    },
  },
  block: {
    block: true,
    heading: true,
    domSelector: ["h3"],
    domElement: "h3",
    xmlName: "Heading3",
    docxStyles: {
      heading: 3,
      outlineLevel: 3,
    },
  },
  tag: {
    block: true,
    heading: true,
    domSelector: ["h4"],
    domElement: "h4",
    xmlName: "Heading4",
    docxStyles: {
      heading: 4,
      outlineLevel: 4,
    },
  },
  text: {
    block: true,
    heading: false,
    domSelector: ["p"],
    domElement: "p",
  },
  underline: {
    block: false,
    heading: false,
    domSelector: ["span", "u"],
    domElement: "u",
    docxStyles: {
      underline: {},
    },
  },
  strong: {
    block: false,
    heading: false,
    domSelector: ["strong"],
    domElement: "b",
    docxStyles: {
      bold: true,
    },
  },
  mark: {
    block: false,
    heading: false,
    domSelector: ["mark"],
    domElement: "mark",
    docxStyles: {
      highlight: "cyan",
    },
  },
};