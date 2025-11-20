// Perlin Noise implementation
const permutation = new Array(256).fill(0).map((_, i) => i);
for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
}

const p = new Array(512).fill(0).map((_, i) => permutation[i % 256]);

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
}

function grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return lerp(
        w,
        lerp(
            v,
            lerp(
                u,
                grad(p[AA], x, y, z),
                grad(p[BA], x - 1, y, z)
            ),
            lerp(
                u,
                grad(p[AB], x, y - 1, z),
                grad(p[BB], x - 1, y - 1, z)
            )
        ),
        lerp(
            v,
            lerp(
                u,
                grad(p[AA + 1], x, y, z - 1),
                grad(p[BA + 1], x - 1, y, z - 1)
            ),
            lerp(
                u,
                grad(p[AB + 1], x, y - 1, z - 1),
                grad(p[BB + 1], x - 1, y - 1, z - 1)
            )
        )
    );
} 