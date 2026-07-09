const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = path.join(__dirname, "../components/marketing/AsciiArt.tsx");

// ASCII characters from dark to light
const ASCII_CHARS = " .:-=+*#%@";

async function run() {
    console.log("Reading image for ASCII...");
    const image = await Jimp.read(INPUT_PATH);
    
    // Resize to a small grid for ASCII (e.g. 100 chars wide)
    // Aspect ratio needs adjustment because characters are usually taller than they are wide (e.g., 2:1)
    image.resize(120, Jimp.AUTO);
    image.resize(120, image.bitmap.height * 0.5);
    image.grayscale();
    image.contrast(0.4);

    let asciiStr = "";
    
    for (let y = 0; y < image.bitmap.height; y++) {
        for (let x = 0; x < image.bitmap.width; x++) {
            const hex = image.getPixelColor(x, y);
            const rgba = Jimp.intToRGBA(hex);
            const luma = rgba.r; // 0-255
            
            // Map luma to ASCII char
            const charIdx = Math.floor((luma / 255) * (ASCII_CHARS.length - 1));
            asciiStr += ASCII_CHARS[charIdx];
        }
        asciiStr += "\\n";
    }
    
    const componentCode = `export default function AsciiArt() {
    return (
        <div className="font-mono text-[8px] leading-[8px] tracking-tighter text-primary/40 whitespace-pre overflow-hidden select-none" aria-hidden>
            {\`${asciiStr}\`}
        </div>
    );
}
`;

    fs.writeFileSync(OUTPUT_PATH, componentCode);
    console.log("Saved ASCII component to", OUTPUT_PATH);
}

run().catch(console.error);
