// Stage coordinates -> pixels of the full-stage snapshot the preview samples.
export function stageToSnapshot(points, snapshotScale) {
    return points.map(p => ({ x: p.x * snapshotScale, y: p.y * snapshotScale }));
}

// Stage coordinates -> pixels of the exported capture (the selection crop).
export function stageToCapture(points, { selX, selY, stageScale, scaleX, scaleY }) {
    return points.map(p => ({
        x: (p.x / stageScale - selX) * scaleX,
        y: (p.y / stageScale - selY) * scaleY,
    }));
}
