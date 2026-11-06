import fileSystem from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import typescript from 'typescript';

export function checkArchitecture(sources) {
  const errors = [];
  const graph = new Map();
  for (const [file, content] of Object.entries(sources)) {
    const source = typescript.createSourceFile(
      file,
      content,
      typescript.ScriptTarget.Latest,
      true,
    );
    const edges = [];
    const feature = file.match(/^src\/features\/([^/]+)\//)?.[1];
    const domain = file.includes('/domain/');
    function visit(node) {
      let specifier;
      if (
        (typescript.isImportDeclaration(node) ||
          typescript.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        typescript.isStringLiteral(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      if (typescript.isCallExpression(node)) {
        const call = node.expression.getText(source);
        if (
          (call === 'require' ||
            node.expression.kind === typescript.SyntaxKind.ImportKeyword) &&
          node.arguments[0] &&
          typescript.isStringLiteral(node.arguments[0])
        )
          specifier = node.arguments[0].text;
        if (
          file.startsWith('app/') &&
          ['fetch', 'XMLHttpRequest'].includes(call)
        )
          errors.push(`${file}: screens must use application services`);
      }
      if (specifier) {
        let target;
        if (specifier.startsWith('@/')) target = `src/${specifier.slice(2)}`;
        else if (specifier.startsWith('.'))
          target = path.posix.normalize(
            path.posix.join(path.posix.dirname(file), specifier),
          );
        if (
          domain &&
          (/^(react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@expo\/)/.test(
            specifier,
          ) ||
            /(?:sqlite|\/data\/|\/core\/(?:database|api|files)\/)/.test(
              target ?? specifier,
            ))
        )
          errors.push(`${file}: domain cannot import ${specifier}`);
        if (target) {
          const other = target.match(/^src\/features\/([^/]+)\/(.*)$/);
          if (
            feature &&
            other &&
            other[1] !== feature &&
            other[2] !== 'index' &&
            other[2] !== 'index.ts'
          )
            errors.push(`${file}: cross-feature private import ${specifier}`);
          const resolved = [
            target,
            `${target}.ts`,
            `${target}.tsx`,
            `${target}/index.ts`,
            `${target}/index.tsx`,
          ].find((candidate) => Object.hasOwn(sources, candidate));
          if (resolved) edges.push(resolved);
          if (file.startsWith('app/') && /\/core\/(?:sync|api)\//.test(target))
            errors.push(`${file}: screens cannot import raw transport/sync`);
        }
      }
      typescript.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, edges);
  }
  const active = new Set();
  const visited = new Set();
  function walk(file) {
    if (active.has(file)) {
      errors.push(`Circular dependency at ${file}`);
      return;
    }
    if (visited.has(file)) return;
    active.add(file);
    for (const edge of graph.get(file) ?? []) walk(edge);
    active.delete(file);
    visited.add(file);
  }
  for (const file of graph.keys()) walk(file);
  return errors;
}

function readSources(directory, sources = {}) {
  if (!fileSystem.existsSync(directory)) return sources;
  for (const item of fileSystem.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const file = `${directory}/${item.name}`;
    if (item.isDirectory()) readSources(file, sources);
    else if (/\.[cm]?[jt]sx?$/.test(file))
      sources[file] = fileSystem.readFileSync(file, 'utf8');
  }
  return sources;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const errors = checkArchitecture({
    ...readSources('src'),
    ...readSources('app'),
  });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Architecture boundaries and import cycles checked.');
}
