import Cairo from 'gi://cairo';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import System from 'system';

let failures = 0;

export function test(name, fn) {
    try {
        fn();
        print(`ok   ${name}`);
    } catch (e) {
        failures++;
        print(`FAIL ${name}\n     ${e.message}`);
    }
}

export function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}

export function finish() {
    if (failures > 0) {
        print(`${failures} test(s) failed`);
        System.exit(1);
    }
    print('all passed');
}

// Deterministic per-pixel noise (Park-Miller LCG) so every block of the
// original holds distinct detail that pixelation must destroy.
export function noiseSurface(w, h, seed = 1) {
    const s = new Cairo.ImageSurface(Cairo.Format.ARGB32, w, h);
    const cr = new Cairo.Context(s);
    let x = seed;
    const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            cr.setSourceRGBA(rnd(), rnd(), rnd(), 1);
            cr.rectangle(px, py, 1, 1);
            cr.fill();
        }
    }
    cr.$dispose();
    return s;
}

export function blankSurface(w, h) {
    return new Cairo.ImageSurface(Cairo.Format.ARGB32, w, h);
}

export function copySurface(surface) {
    const s = blankSurface(surface.getWidth(), surface.getHeight());
    const cr = new Cairo.Context(s);
    cr.setSourceSurface(surface, 0, 0);
    cr.paint();
    cr.$dispose();
    return s;
}

// GJS's Cairo bindings expose no pixel accessor, so round-trip through PNG.
export function readPixels(surface) {
    const dir = GLib.dir_make_tmp('gradia-test-XXXXXX');
    const path = GLib.build_filenamev([dir, 'out.png']);
    surface.writeToPNG(path);
    const pb = GdkPixbuf.Pixbuf.new_from_file(path);
    GLib.unlink(path);
    GLib.rmdir(dir);

    const data = pb.read_pixel_bytes().get_data();
    const stride = pb.get_rowstride();
    const n = pb.get_n_channels();
    return {
        width: pb.get_width(),
        height: pb.get_height(),
        at(x, y) {
            const o = y * stride + x * n;
            return Array.from(data.slice(o, o + n)).join(',');
        },
    };
}

export function uniqueColours(px, { x, y, width, height }) {
    const seen = new Set();
    for (let py = y; py < y + height; py++)
        for (let qx = x; qx < x + width; qx++)
            seen.add(px.at(qx, py));
    return seen;
}
