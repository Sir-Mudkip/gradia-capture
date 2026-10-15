import { stageToSnapshot, stageToCapture } from '../src/geometry.js';
import { CENSOR_BLOCK_PX } from '../src/pixelate.js';
import { test, assert, finish } from './helpers.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;
const stroke = [{ x: 310, y: 205 }, { x: 402.5, y: 251 }];

// The preview samples a full-stage snapshot; export samples the cropped
// capture. For the same stroke both must see the same pixels, or what is
// censored on screen is not what gets saved.
for (const scale of [1, 1.25, 1.5, 2]) {
    test(`preview and export sample the same pixels at scale ${scale}`, () => {
        const sel = { selX: 200, selY: 150, selW: 640, selH: 360 };
        const preview = stageToSnapshot(stroke, scale);
        const capture = stageToCapture(stroke, {
            ...sel,
            stageScale: 1,
            scaleX: scale,
            scaleY: scale,
        });
        for (let i = 0; i < stroke.length; i++) {
            assert(close(capture[i].x, preview[i].x - sel.selX * scale),
                `x[${i}]: capture ${capture[i].x} vs preview ${preview[i].x} - ${sel.selX * scale}`);
            assert(close(capture[i].y, preview[i].y - sel.selY * scale),
                `y[${i}]: capture ${capture[i].y} vs preview ${preview[i].y} - ${sel.selY * scale}`);
        }
        const blocks = pts => Math.floor(Math.abs(pts[1].x - pts[0].x) / CENSOR_BLOCK_PX);
        assert(blocks(preview) === blocks(capture), 'preview and export block counts differ');
    });
}

test('stage scale factor divides stage coordinates before the selection offset', () => {
    const [p] = stageToCapture([{ x: 400, y: 300 }],
        { selX: 100, selY: 50, stageScale: 2, scaleX: 1, scaleY: 1 });
    assert(close(p.x, 100) && close(p.y, 100), `got ${p.x},${p.y}`);
});

test('mappings do not mutate their input', () => {
    const pts = [{ x: 1, y: 2 }];
    stageToSnapshot(pts, 2);
    stageToCapture(pts, { selX: 0, selY: 0, stageScale: 1, scaleX: 3, scaleY: 3 });
    assert(pts[0].x === 1 && pts[0].y === 2, 'input points were modified');
});

finish();
