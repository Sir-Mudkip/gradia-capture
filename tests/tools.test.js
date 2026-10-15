import Cairo from 'gi://cairo';
import GLib from 'gi://GLib';
import { TOOLS, TOOL_SHORTCUTS } from '../src/tools.js';
import {
    test, assert, finish, noiseSurface, blankSurface, copySurface, readPixels,
} from './helpers.js';

const ROOT = GLib.path_get_dirname(
    GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));
const censor = TOOLS.find(t => t.id === 'censor');

test('censor tool exists', () => {
    assert(censor, 'no tool with id "censor"');
});

test('censor sits directly after solid-rectangle', () => {
    const i = TOOLS.findIndex(t => t.id === 'solid-rectangle');
    assert(TOOLS[i + 1]?.id === 'censor', `found ${TOOLS[i + 1]?.id} after solid-rectangle`);
});

test('censor draws but has no colour or width', () => {
    assert(censor.isDrawing === true, 'isDrawing is not true');
    assert(censor.hasStyle === false, 'hasStyle is not false');
});

test('censor keybindings are 0, agrave and x, all defined', () => {
    assert(censor.keybindings.length === 3, 'expected three keybindings');
    assert(censor.keybindings.every(k => typeof k === 'number'),
        'a keybinding is undefined — check the Clutter.KEY_* names');
});

test('no two tools share a shortcut', () => {
    const total = TOOLS.reduce((n, t) => n + t.keybindings.length, 0);
    const distinct = Object.keys(TOOL_SHORTCUTS).length;
    assert(distinct === total, `${total} keybindings but only ${distinct} distinct`);
});

test('censor icon file exists', () => {
    const path = GLib.build_filenamev([ROOT, censor.icon]);
    assert(GLib.file_test(path, GLib.FileTest.EXISTS), `missing ${path}`);
});

test('render with a source pixelates the rectangle', () => {
    const src = noiseSurface(64, 48);
    const target = copySurface(src);
    const cr = new Cairo.Context(target);
    const points = [{ x: 8, y: 8 }, { x: 20, y: 20 }, { x: 40, y: 32 }];
    censor.render(cr, { color: '#000000', points, source: src, sourcePoints: points }, 4);
    cr.$dispose();

    const px = readPixels(target);
    for (let by = 0; by < 3; by++) {
        for (let bx = 0; bx < 4; bx++) {
            const x0 = 8 + bx * 8, y0 = 8 + by * 8, first = px.at(x0, y0);
            for (let y = y0; y < y0 + 8; y++)
                for (let x = x0; x < x0 + 8; x++)
                    assert(px.at(x, y) === first, `block ${bx},${by} not uniform at (${x},${y})`);
        }
    }
});

test('render without a source paints an opaque box (fail-safe)', () => {
    const target = blankSurface(40, 40);
    const cr = new Cairo.Context(target);
    censor.render(cr, { color: '#000000', points: [{ x: 5, y: 5 }, { x: 35, y: 30 }] }, 4);
    cr.$dispose();

    const px = readPixels(target);
    for (let y = 5; y < 30; y++)
        for (let x = 5; x < 35; x++)
            assert(px.at(x, y).endsWith(',255'), `(${x},${y}) not opaque: ${px.at(x, y)}`);
});

test('render with fewer than two points draws nothing', () => {
    const target = blankSurface(16, 16);
    const cr = new Cairo.Context(target);
    censor.render(cr, { color: '#000000', points: [{ x: 4, y: 4 }] }, 4);
    cr.$dispose();
    assert(readPixels(target).at(4, 4) === '0,0,0,0', 'single-point stroke drew pixels');
});

finish();
