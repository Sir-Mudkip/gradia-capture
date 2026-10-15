import Cairo from 'gi://cairo';

export const CENSOR_BLOCK_PX = 8;

function clampToSource(source, srcRect, dstRect) {
    if (srcRect.width <= 0 || srcRect.height <= 0 || dstRect.width <= 0 || dstRect.height <= 0)
        return null;

    const x0 = Math.max(0, srcRect.x);
    const y0 = Math.max(0, srcRect.y);
    const x1 = Math.min(source.getWidth(), srcRect.x + srcRect.width);
    const y1 = Math.min(source.getHeight(), srcRect.y + srcRect.height);
    if (x1 <= x0 || y1 <= y0)
        return null;

    const kx = dstRect.width / srcRect.width;
    const ky = dstRect.height / srcRect.height;
    return {
        src: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
        dst: {
            x: dstRect.x + (x0 - srcRect.x) * kx,
            y: dstRect.y + (y0 - srcRect.y) * ky,
            width: (x1 - x0) * kx,
            height: (y1 - y0) * ky,
        },
    };
}

// Port of Gradia's CensorAction._draw_pixelation: one pixel per block of
// source pixels, scaled back with nearest-neighbour so detail is discarded.
export function pixelate(cr, source, srcRect, dstRect, blockPx = CENSOR_BLOCK_PX) {
    const clamped = clampToSource(source, srcRect, dstRect);
    if (!clamped)
        return;
    const { src, dst } = clamped;

    const blocksX = Math.max(1, Math.floor(src.width / blockPx));
    const blocksY = Math.max(1, Math.floor(src.height / blockPx));

    const tiny = new Cairo.ImageSurface(Cairo.Format.ARGB32, blocksX, blocksY);
    const tcr = new Cairo.Context(tiny);
    tcr.scale(blocksX / src.width, blocksY / src.height);
    tcr.translate(-src.x, -src.y);
    const sourcePattern = new Cairo.SurfacePattern(source);
    sourcePattern.setExtend(Cairo.Extend.PAD);
    tcr.setSource(sourcePattern);
    tcr.paint();
    tcr.$dispose();

    const blocks = new Cairo.SurfacePattern(tiny);
    blocks.setFilter(Cairo.Filter.NEAREST);

    cr.save();
    cr.rectangle(dst.x, dst.y, dst.width, dst.height);
    cr.clip();
    cr.translate(dst.x, dst.y);
    cr.scale(dst.width / blocksX, dst.height / blocksY);
    cr.setSource(blocks);
    cr.paint();
    cr.restore();
}
