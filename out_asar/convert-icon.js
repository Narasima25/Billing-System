const fs = require('fs');
const { Jimp } = require('jimp');
const pngToIco = require('png-to-ico').default;

async function run() {
  try {
    const image = await Jimp.read('src/logo.png');
    // Resize to a square 256x256
    image.resize({ w: 256, h: 256 });
    await image.write('src/logo-square.png');
    
    const buf = await pngToIco('src/logo-square.png');
    fs.writeFileSync('src/logo.ico', buf);
    console.log('Successfully created src/logo.ico');
  } catch (err) {
    console.error(err);
  }
}

run();
