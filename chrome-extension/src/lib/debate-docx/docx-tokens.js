
const getStyleNameByXml = (elXmlName) => {
  var _a;
  const predicate = ({ xmlName = null }) => elXmlName === xmlName;
  return (_a = findKey(exports.styleMap, predicate)) !== null && _a !== void 0
    ? _a
    : "text";
};
exports.getStyleNameByXml = getStyleNameByXml;
const getOutlineLvlName = (outlineLvl) => {
  var _a;
  const predicate = ({ docxStyles = null }) =>
    outlineLvl ===
    (docxStyles === null || docxStyles === void 0
      ? void 0
      : docxStyles.outlineLevel);
  return (_a = findKey(exports.styleMap, predicate)) !== null && _a !== void 0
    ? _a
    : "text";
};
exports.getOutlineLvlName = getOutlineLvlName;
const getStyles = () => {
  return Object.keys(exports.styleMap);
};
exports.getStyles = getStyles;
const getHeadingStyles = () => {
  return Object.keys(exports.styleMap).filter(
    (key) => exports.styleMap[key].heading
  );
  // .map((key) => exports.styleMap[key]);
};
exports.getHeadingStyles = getHeadingStyles;
const getDocxStyles = (styles) => {
  const mergedStyles = Object.keys(styles).reduce((acc, key) => {
    var _a;
    return {
      ...acc,
      ...((_a = exports.styleMap[key]) === null || _a === void 0
        ? void 0
        : _a.docxStyles),
    };
  }, {});
  return mergedStyles;
};
exports.getDocxStyles = getDocxStyles;

const tokensToMarkup = (textBlocks, plainTextOnly = false) => {
  let _a, dom = "";

  const state = { underline: false, strong: false, mark: false };

  textBlocks.forEach(({ format, tokens }) => {
    if (!tokens.length) return;
    const { domElement } = exports.styleMap[format];

    if (!plainTextOnly) 
      dom += `<${domElement}>`;
    tokens.forEach(({ text, format }) => {
      var _a;
      if (!text || text.trim().length < 1) return;
      let tags = "";
      for (const style in state) {
        if (state[style] !== format[style]) {
          const elName =
            (_a = exports.styleMap[style]) === null || _a === void 0
              ? void 0
              : _a.domElement;
          tags += `<${format[style] ? "" : "/"}${elName}>`;
          state[style] = format[style];

        }
      }


      if (plainTextOnly) dom += text;
      else dom += tags + text;
    });

    if (plainTextOnly) dom += " \n";
    else dom += `</${domElement}>`;
  });
  // // Make sure to close tags
  if (!plainTextOnly)
  for (const style in state)
    if (state[style])
      dom += `</${
        (_a = exports.styleMap[style]) === null || _a === void 0
          ? void 0
          : _a.domElement
      }>`;
  dom = dom.replace(/ \n$/, "");

  return dom;
};
exports.tokensToMarkup = tokensToMarkup;
const isSameFormat = (a, b) =>
  a.mark === b.mark && a.strong === b.strong && a.underline === b.underline;
const simplifyTokens = (block) => {
  const simplifiedTokens = block.tokens.reduce((acc, { format, text }) => {
    if (!acc.length) return [{ format, text }];
    const prev = acc[acc.length - 1];
    const { format: prevFormat, text: prevText } = prev;
    // If same format just combine text
    isSameFormat(format, prevFormat)
      ? (prev.text = prevText + text)
      : acc.push({ text, format });
    return acc;
  }, []);
  return { format: block.format, tokens: simplifiedTokens };
};
exports.simplifyTokens = simplifyTokens;

function findKey(object, predicate) {
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
}
exports.styleMap = {
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
