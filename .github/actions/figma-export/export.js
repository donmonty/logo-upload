const { ensureDir, writeFile } = require('fs-extra')
const { join, resolve } = require('path')
const Figma = require('figma-js')
const { FIGMA_TOKEN, FIGMA_FILE_URL } = process.env
const PQueue = require('p-queue')
const sanitize = require("sanitize-filename")
const got = require('got')

async function run() {

  const options = {
    format: 'jpg',
    outputDir: '../../../logos',
    scale: '1'
  }

  const client = Figma.Client({
    personalAccessToken: FIGMA_TOKEN
  })

  const fileId = FIGMA_FILE_URL.match(/file\/([a-z0-9]+)\//i)[1]
  console.log(`Exporting ${FIGMA_FILE_URL} components`)

  const components = {};

  function check(c) {
    if (c.type === 'COMPONENT') {
      const { name, id } = c
      const { description = '', key } = data.components[c.id]
      const { width, height } = c.absoluteBoundingBox
      const filename = `${sanitize(name).toLowerCase()}.${options.format}`;

      components[id] = {
        name,
        filename,
        id,
        key,
        file: fileId,
        description,
        width,
        height
      }
    } else if (c.children) {
      // eslint-disable-next-line github/array-foreach
      c.children.forEach(check)
    }
  }

  let data;

  try {

    data = await client.file(fileId);
    data.document.children.forEach(check);
    if (Object.values(components).length === 0) {
      throw Error('No components found!')
    }
    console.log(`${Object.values(components).length} components found in the Figma file`);
    console.log('Getting export urls');

    data = await client.fileImages(
      fileId,
      {
        format: options.format,
        ids: Object.keys(components),
        scale: options.scale
      }
    );

    for (const id of Object.keys(data.images)) {
      components[id].image = data.images[id];
    }
     console.log("Components: ", components);
  } catch(err) {
    console.log("Error at run function:", err);
  }

}

run();