const { ensureDir, writeFile } = require('fs-extra')
const { join, resolve } = require('path')
const Figma = require('figma-js')
const { FIGMA_TOKEN, FIGMA_FILE_URL } = process.env
const PQueue = require('p-queue')
const sanitize = require("sanitize-filename")
const got = require('got')

function run() {

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
  client.file(fileId)
  
    .then(({ data }) => {
      console.log('Processing response')
      const components = {}
  
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
  
      data.document.children.forEach(check)
      if (Object.values(components).length === 0) {
        throw Error('No components found!')
      }
      console.log(`${Object.values(components).length} components found in the Figma file`)
      return components
    })
    .then(components => {
      console.log('Getting export urls')
      return client.fileImages(
        fileId,
        {
          format: options.format,
          ids: Object.keys(components),
          scale: options.scale
        }
      ).then(({data}) => {
        for(const id of Object.keys(data.images)) {
          components[id].image = data.images[id]
        }
        return components
      })
    })
    .then(components => {
      return ensureDir(join(options.outputDir))
        .then(() => writeFile(resolve(options.outputDir, 'data.json'), JSON.stringify(components), 'utf8'))
        .then(() => components)
    })
    .then(components => {
      const contentTypes = {
        'svg': 'image/svg+xml',
        'png': 'image/png',
        'jpg': 'image/jpeg'
      }
      return queueTasks(Object.values(components).map(component => () => {
        return got.get(component.image, {
          headers: {
            'Content-Type': contentTypes[options.format]
          },
          encoding: (options.format === 'svg' ? 'utf8' : null)
        })
        .then(response => {
          return ensureDir(join(options.outputDir, options.format))
            .then(() => writeFile(join(options.outputDir, options.format, component.filename), response.body, (options.format === 'svg' ? 'utf8' : 'binary')))
        })
      }))
    })
    .catch(error => {
      throw Error(`Error fetching components from Figma: ${error}`)
    })
  
  function queueTasks(tasks, options) {
    const queue = new PQueue(Object.assign({concurrency: 3}, options))
    for (const task of tasks) {
      queue.add(task)
    }
    queue.start()
    return queue.onIdle()
  }
}

run();
