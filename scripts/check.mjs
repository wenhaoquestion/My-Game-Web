import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = await readdir(root);
for (const file of files.filter(name => name.endsWith('.js'))) {
    new vm.Script(await readFile(path.join(root, file), 'utf8'), { filename: file });
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
const sandbox = { window: {} };
vm.runInNewContext(await readFile(path.join(root, 'catalog.js'), 'utf8'), sandbox);
const catalog = sandbox.window.ArcadeCatalog;
assert.equal(catalog.length, new Set(catalog.map(game => game.id)).size, 'Game routes must be unique');
for (const game of catalog) {
    assert.ok(ids.includes(game.screen), 'Missing screen for ' + game.id);
    const source = await readFile(path.join(root, game.script), 'utf8');
    assert.ok(new RegExp('(?:function\\s+' + game.init + '\\s*\\(|window\\.' + game.init + '\\s*=)').test(source), 'Missing initializer for ' + game.id);
    assert.ok(Number.isInteger(game.cover) && game.cover >= 0 && game.cover < 12, 'Invalid cover for ' + game.id);
}
const localAssets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map(match => match[1]).filter(value => !/^(https?:|data:)/.test(value));
for (const asset of localAssets) await access(path.join(root, asset));
for (const file of ['style.css', ...(await readdir(path.join(root, 'styles'))).filter(name => name.endsWith('.css')).map(name => 'styles/' + name)]) {
    const css = await readFile(path.join(root, file), 'utf8');
    for (const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
        if (/^(data:|https?:)/.test(match[1])) continue;
        await access(path.resolve(root, path.dirname(file), match[1]));
    }
}
console.log('Passed: JavaScript syntax, unique DOM IDs, ' + catalog.length + ' game contracts, and local HTML/CSS assets.');
