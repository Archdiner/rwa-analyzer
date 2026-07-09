const Jimp = require("jimp");
const path = require("path");

// Usage: node scripts/dither.js <input> [output] [width]
const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = process.argv[3] || path.join(__dirname, "../public/hero-vault.png");
const WIDTH = Number(process.argv[4]) || 1000;

// 4x4 Bayer matrix (ordered dithering)
const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
];

// Monochrome duotone: warm bone highlights on a transparent field so the art
// dissolves into the page background instead of sitting on a hard rectangle.
const LIGHT = { r: 232, g: 226, b: 214, a: 255 }; // #e8e2d6 (bone)
const DARK = { r: 0, g: 0, b: 0, a: 0 }; // transparent

async function run() {
    const image = await Jimp.read(INPUT_PATH);
    image.resize(WIDTH, Jimp.AUTO);
    image.grayscale();
    // Drop the midtones so only lit structure survives the dither: gives a
    // sparse dot field that traces the subject and dissolves into the page.
    image.brightness(-0.22);
    image.contrast(0.3);

    for (let y = 0; y < image.bitmap.height; y++) {
        for (let x = 0; x < image.bitmap.width; x++) {
            const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
            const luma = rgba.r;
            const threshold = (bayer[y % 4][x % 4] / 16) * 255;
            const out = luma > threshold ? LIGHT : DARK;
            image.setPixelColor(Jimp.rgbaToInt(out.r, out.g, out.b, out.a), x, y);
        }
    }

    await image.writeAsync(OUTPUT_PATH);
    console.log("Dithered ->", OUTPUT_PATH, `${image.bitmap.width}x${image.bitmap.height}`);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
