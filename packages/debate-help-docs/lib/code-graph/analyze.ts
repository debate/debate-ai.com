/**
 * @file Source-file analyser: imports, exports, functions and types, with
 * their JSDoc, signatures and line numbers.
 *
 * Vendored from code-tree-graph's ESTree analyser, parsing with `oxc-parser`
 * instead of `@typescript-eslint/typescript-estree` + the TypeScript compiler
 * API: this repo is on TypeScript 7, which ships no JavaScript API, and oxc
 * reads `.ts`, `.tsx`, `.js` and `.jsx` alike, so one analyser covers them all.
 */
import fs from "fs";
import path from "path";
import { parseSync } from "oxc-parser";
import type { AnalysisItem, AnalysisKind, FileAnalysis, TypeProperty } from "./types";
import { PARSEABLE_EXTS, SYSTEM_MODULES } from "./constants";

/** What may sit between a JSDoc block and the declaration it documents. */
const LEADING_GAP = /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?$/;

/** 1-based line of each character offset, from a table of line starts. */
function lineLookup(content: string): (offset: number) => number {
  const starts = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * Analyse a source file.
 *
 * @param filePath - Absolute path (or virtual name when `providedContent` is given).
 * @param providedContent - Optional in-memory source text to analyse instead of reading from disk.
 * @returns Parsed import/export information, or `undefined` when the file is not parseable.
 */
export function analyzeFile(filePath: string, providedContent?: string): FileAnalysis | undefined {
  if (!PARSEABLE_EXTS.has(path.extname(filePath))) return undefined;
  return analyzeFileEstree(filePath, providedContent);
}

/**
 * Analyse a source file using the ESTree AST.
 *
 * @param filePath - Absolute path used for reading (ignored when `providedContent` is set).
 * @param providedContent - Optional in-memory source text.
 * @returns Parsed import/export information, or `undefined` if the file cannot be parsed.
 */
export function analyzeFileEstree(filePath: string, providedContent?: string): FileAnalysis | undefined {
  let content: string;
  if (providedContent !== undefined) {
    content = providedContent;
  } else {
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      return undefined;
    }
  }

  let ast: any;
  try {
    const result = parseSync(filePath, content, { range: true });
    if (result.errors.some((e: any) => e.severity === "Error")) return undefined;
    ast = { body: result.program.body, comments: result.comments };
  } catch {
    return undefined;
  }
  const lineOf = lineLookup(content);
  const startLine = (node: any) => lineOf(node.start);

  const localImports: string[] = [];
  const localImportSymbols: {
    source: string;
    valueNames: string[];
    typeNames: string[];
  }[] = [];
  const npmImports: string[] = [];
  const exports: AnalysisItem[] = [];
  const functions: AnalysisItem[] = [];
  const types: AnalysisItem[] = [];

  /**
   * Find the closest preceding JSDoc block comment for a node.
   * @returns The cleaned comment text, or `undefined`.
   */
  function getJsDoc(node: any): string | undefined {
    if (!ast.comments) return undefined;
    // The JSDoc block directly ahead of the node: nothing but whitespace (or
    // the `export` / `default` / `declare` keywords the node's span leaves
    // out) between them. Upstream matched by line distance alone, so on a
    // one-line `/** … */ interface Box { a: number }` every member took the
    // interface's comment.
    let closestComment: any = undefined;
    for (const comment of ast.comments) {
      if (comment.type !== 'Block' || !comment.value.startsWith('*') || comment.end > node.start) continue;
      if (!closestComment || comment.end > closestComment.end) closestComment = comment;
    }
    if (closestComment && !LEADING_GAP.test(content.slice(closestComment.end, node.start))) {
      closestComment = undefined;
    }

    if (closestComment) {
       const lines = closestComment.value.split('\n');
       for (const line of lines) {
         if (line.includes('@description')) return line.split('@description')[1].trim();
       }
       return lines.map((l: string) => l.replace(/^\s*\*\s?/, '').trim()).filter((l: string) => l && !l.startsWith('@')).join('\n').trim() || undefined;
    }
    return undefined;
  }

  /**
   * Extract a condensed signature string from a declaration node.
   */
  function getSignature(node: any): string | undefined {
      if (!node.range) return undefined;
      if (node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction') {
         const headEnd = node.body ? node.body.range[0] : node.range[1];
         return content.slice(node.range[0], headEnd).replace(/^export\s+|default\s+|async\s+/g, '').trim();
      }
      if (node.type === 'VariableDeclarator') {
         if (node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
            const headEnd = node.init.body.range[0];
            return content.slice(node.init.range[0], headEnd).trim();
         }
         return node.id.typeAnnotation ? content.slice(node.id.typeAnnotation.range[0], node.id.typeAnnotation.range[1]) : undefined;
      }
      if (node.type === 'TSTypeAliasDeclaration' || node.type === 'TSInterfaceDeclaration' || node.type === 'TSEnumDeclaration' || node.type === 'ClassDeclaration') {
         return content.slice(node.range[0], node.range[1]);
      }
      return undefined;
  }

  /**
   * Extract properties from an interface or type-literal node.
   */
  function getProperties(node: any): TypeProperty[] | undefined {
      let members: any[] = [];
      if (node.type === 'TSInterfaceDeclaration' && node.body && node.body.body) {
          members = node.body.body;
      } else if (node.type === 'TSTypeAliasDeclaration' && node.typeAnnotation && node.typeAnnotation.type === 'TSTypeLiteral') {
          members = node.typeAnnotation.members;
      }

      if (!members.length) return undefined;

      const props: TypeProperty[] = [];
      for (const member of members) {
          if (member.type === 'TSPropertySignature' && member.key && member.key.name) {
             const required = !member.optional;
             const type = member.typeAnnotation ? content.slice(member.typeAnnotation.typeAnnotation.range[0], member.typeAnnotation.typeAnnotation.range[1]) : 'unknown';
             const propDoc = getJsDoc(member);
             const prop: TypeProperty = { name: member.key.name, type, required };
             if (propDoc) prop.description = propDoc;
             props.push(prop);
          }
      }
      return props.length > 0 ? props : undefined;
  }

  /**
   * Build an {@link AnalysisItem} from a declaration node.
   */
  function item(name: string, node: any, kind?: AnalysisKind): AnalysisItem {
    const line = startLine(node);
    const jsdoc = getJsDoc(node);
    const signature = getSignature(node);
    const properties = getProperties(node);
    const result: AnalysisItem = { name, line };
    if (kind) result.kind = kind;
    if (jsdoc) result.jsdoc = jsdoc;
    if (signature) result.signature = signature;
    if (properties) result.properties = properties;
    return result;
  }

  /**
   * Process a single top-level AST node, populating the result arrays.
   */
  function processNode(node: any, isExported: boolean = false) {
     if (node.type === 'ImportDeclaration') {
        const mod = node.source.value;
        if (!SYSTEM_MODULES.has(mod)) {
            const isLocal = mod.startsWith(".") || mod.startsWith("/");
            const list = isLocal ? localImports : npmImports;
            if (!list.includes(mod)) list.push(mod);
            if (isLocal) {
               const symbolEntry = { source: mod, valueNames: [] as string[], typeNames: [] as string[] };
               for (const specifier of node.specifiers) {
                   if (specifier.type === 'ImportSpecifier') {
                       if (node.importKind === 'type' || specifier.importKind === 'type') {
                           symbolEntry.typeNames.push(specifier.local.name);
                       } else {
                           symbolEntry.valueNames.push(specifier.local.name);
                       }
                   } else if (specifier.type === 'ImportDefaultSpecifier') {
                       if (node.importKind === 'type') symbolEntry.typeNames.push(specifier.local.name);
                       else symbolEntry.valueNames.push(specifier.local.name);
                   }
               }
               if (symbolEntry.valueNames.length > 0 || symbolEntry.typeNames.length > 0) {
                   localImportSymbols.push(symbolEntry);
               }
            }
        }
     } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
            processNode(node.declaration, true);
        } else {
            for (const specifier of node.specifiers) {
                exports.push(item(specifier.exported.name, node));
            }
        }
     } else if (node.type === 'ExportDefaultDeclaration') {
         exports.push(item('default', node.declaration));
     } else if (node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction') {
         const entry = item(node.id ? node.id.name : 'default', node, 'function');
         if (isExported) exports.push(entry);
         else functions.push(entry);
     } else if (node.type === 'ClassDeclaration') {
         const entry = item(node.id ? node.id.name : 'default', node, 'class');
         if (isExported) exports.push(entry);
         else functions.push(entry);
     } else if (node.type === 'VariableDeclaration') {
         for (const decl of node.declarations) {
             if (decl.id.type === 'Identifier') {
                const isFunc = decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression');
                const entry = item(decl.id.name, decl, isFunc ? 'function' : 'constant');

                if (!entry.jsdoc) entry.jsdoc = getJsDoc(node);

                if (isExported) exports.push(entry);
                else if (isFunc) functions.push(entry);
             }
         }
     } else if (node.type === 'TSTypeAliasDeclaration' || node.type === 'TSInterfaceDeclaration' || node.type === 'TSEnumDeclaration') {
         const entry = item(node.id ? node.id.name : 'unknown', node, 'type');
         if (isExported) exports.push(entry);
         else types.push(entry);
     }
  }

  for (const node of ast.body) {
      processNode(node);
  }

  const hasContent = localImports.length > 0 || localImportSymbols.length > 0 || npmImports.length > 0 ||
    exports.length > 0 || functions.length > 0 || types.length > 0;
  if (!hasContent) return undefined;
  return { localImports, localImportSymbols, npmImports, exports, functions, types };
}
