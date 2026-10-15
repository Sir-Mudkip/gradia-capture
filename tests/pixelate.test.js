import Cairo from 'gi://cairo';
import { pixelate, CENSOR_BLOCK_PX } from '../src/pixelate.js';
import {
    test, assert, finish, noiseSurface, blankSurface, copySurface, readPixels, uniqueColours,
} from './helpers.js';

// Export case: target starts as a copy of the source, censor drawn in place.
function censorInPlace(source, rect) {
    const target = copySurface(source);
    const cr = new Cairo.Context(target);
    pixelate(cr, source, rect, rect);
    cr.$dispose();
    return target;
}

function assertUniform(px, x0, y0, w, h, label) {
    const first = px.at(x0, y0);
    for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++)
            assert(px.at(x, y) === first, `${label}: (${x},${y}) differs from (${x0},${y0})`);
}

function assertOutsideUnchanged(before, after, rect) {
    for (let y = 0; y < before.height; y++) {
        for (let x = 0; x < before.width; x++) {
            const inside = x >= rect.x && x < rect.x + rect.width &&
                           y >= rect.y && y < rect.y + rect.height;
            if (!inside)
                assert(before.at(x, y) === after.at(x, y), `outside pixel (${x},${y}) changed`);
        }
    }
}

test('block size is 8 image pixels', () => {
    assert(CENSOR_BLOCK_PX === 8, `CENSOR_BLOCK_PX is ${CENSOR_BLOCK_PX}`);
});

test('every block inside the rectangle is a single colour', () => {
    const src = noiseSurface(64, 48);
    const px = readPixels(censorInPlace(src, { x: 8, y: 8, width: 32, height: 24 }));
    for (let by = 0; by < 3; by++)
        for (let bx = 0; bx < 4; bx++)
            assertUniform(px, 8 + bx * 8, 8 + by * 8, 8, 8, `block ${bx},${by}`);
});

test('pixels outside the rectangle are untouched', () => {
    const src = noiseSurface(64, 48);
    const rect = { x: 8, y: 8, width: 32, height: 24 };
    assertOutsideUnchanged(readPixels(src), readPixels(censorInPlace(src, rect)), rect);
});

test('grid is anchored at the rectangle origin', () => {
    const src = noiseSurface(64, 48);
    const px = readPixels(censorInPlace(src, { x: 13, y: 5, width: 24, height: 16 }));
    for (let by = 0; by < 2; by++)
        for (let bx = 0; bx < 3; bx++)
            assertUniform(px, 13 + bx * 8, 5 + by * 8, 8, 8, `block ${bx},${by}`);
});

test('rectangle smaller than a block becomes one block', () => {
    const src = noiseSurface(32, 32);
    const px = readPixels(censorInPlace(src, { x: 10, y: 10, width: 5, height: 3 }));
    assertUniform(px, 10, 10, 5, 3, 'tiny rect');
});

test('partial blocks never yield more colours than blocks', () => {
    const src = noiseSurface(32, 32);
    const rect = { x: 4, y: 4, width: 20, height: 13 };   // floor(20/8)=2, floor(13/8)=1
    const colours = uniqueColours(readPixels(censorInPlace(src, rect)), rect);
    assert(colours.size <= 2, `expected <= 2 colours, got ${colours.size}`);
});

test('zero or negative size draws nothing', () => {
    const src = noiseSurface(32, 32);
    const before = readPixels(src);
    for (const rect of [
        { x: 4, y: 4, width: 0, height: 10 },
        { x: 4, y: 4, width: 10, height: -3 },
    ]) {
        const after = readPixels(censorInPlace(src, rect));
        assertOutsideUnchanged(before, after, { x: 0, y: 0, width: 0, height: 0 });
    }
});

test('reads from the source, not from what is already on the target', () => {
    const src = noiseSurface(32, 32);
    const rect = { x: 0, y: 0, width: 32, height: 32 };
    const expected = readPixels(censorInPlace(src, rect));

    const target = copySurface(src);
    const cr = new Cairo.Context(target);
    cr.setSourceRGBA(1, 0, 0, 1);           // an earlier annotation
    cr.rectangle(0, 0, 32, 32);
    cr.fill();
    pixelate(cr, src, rect, rect);
    cr.$dispose();

    const got = readPixels(target);
    for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++)
            assert(got.at(x, y) === expected.at(x, y), `(${x},${y}) took target pixels`);
});

test('rectangle past the image edge is clamped', () => {
    const src = noiseSurface(32, 32);
    const before = readPixels(src);
    const rect = { x: 20, y: 20, width: 30, height: 30 };   // in-bounds part is 12x12
    const after = readPixels(censorInPlace(src, rect));
    assertUniform(after, 20, 20, 12, 12, 'clamped region');
    assertOutsideUnchanged(before, after, { x: 20, y: 20, width: 12, height: 12 });
});

test('rectangle entirely outside the image draws nothing', () => {
    const src = noiseSurface(32, 32);
    const before = readPixels(src);
    const after = readPixels(censorInPlace(src, { x: 40, y: 40, width: 10, height: 10 }));
    assertOutsideUnchanged(before, after, { x: 0, y: 0, width: 0, height: 0 });
});

test('fractional rectangle edges are fully covered, never blended with the original', () => {
    const src = noiseSurface(32, 32);
    const rect = { x: 4.5, y: 4.5, width: 16, height: 16 };   // 2x2 blocks
    const px = readPixels(censorInPlace(src, rect));
    const covered = { x: 4, y: 4, width: 17, height: 17 };    // every pixel the box touches
    const colours = uniqueColours(px, covered);
    assert(colours.size <= 4, `expected <= 4 block colours, got ${colours.size} (edge blending)`);
});

test('destination may be scaled relative to source (preview case)', () => {
    const src = noiseSurface(64, 64);
    const target = blankSurface(32, 32);
    const cr = new Cairo.Context(target);
    pixelate(cr, src, { x: 0, y: 0, width: 64, height: 64 }, { x: 0, y: 0, width: 32, height: 32 });
    cr.$dispose();
    const px = readPixels(target);
    for (let by = 0; by < 8; by++)
        for (let bx = 0; bx < 8; bx++)
            assertUniform(px, bx * 4, by * 4, 4, 4, `scaled block ${bx},${by}`);
});

finish();
