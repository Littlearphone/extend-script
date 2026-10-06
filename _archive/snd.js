// ==UserScript==
// @name         test
// @namespace    test
// @version      2025-01-26
// @description  try to take over the world!
// @author       You
// @match        https://www.shaoniandream.com/book_detail/*
// @match        https://www.shaoniandream.com/readchapter/*
// @grant        none
// ==/UserScript==
(async () => {
  function detectArticle() {
    const main = document.querySelector('#ChapterMain')
    if (!main) {
      return requestAnimationFrame(detectArticle)
    }
    const titleElement = document.querySelector('.title')
    if (!titleElement) {
      return requestAnimationFrame(detectArticle)
    }
    let content = ''
    content += titleElement.innerText + '\n'
    const chapterElements = document.querySelectorAll('#ChapterContent .chapter')
    if (!chapterElements.length) {
      return requestAnimationFrame(detectArticle)
    }
    chapterElements.forEach(element => {
      const i = element.querySelector('i')
      if (i) {
        element.removeChild(i)
        content += element.innerText + '\n'
      }
    })
    if (top !== window) {
      return top.postMessage(content)
    }
  }

  function iterateLinks(links) {
    if (links.length) {
      const link = links.shift()
      const iframe = document.querySelector('.automation-frame') || (function () {
        const element = document.createElement('iframe')
        element.classList.add('automation-frame')
        document.body.appendChild(element)
        element.style.display = 'none'
        return element
      })()
      iframe.src = link.href
    }
  }

  function detectList() {
    const list = document.querySelectorAll('.chapter_list li a[href^=http]')
    if (!list.length) {
      return requestAnimationFrame(detectList)
    }

    async function callback() {
      document.body.removeEventListener('click', callback)
      const links = Array.from(list)
      const options = {
        suggestedName: 'test.txt',
        types: [
          {
            description: 'Text Files',
            accept: {
              'text/plain': ['.txt'],
            },
          },
        ],
      }
      const writeHandle = await window.showSaveFilePicker(options)
      // Create a FileSystemWritableFileStream to write to.
      const writable = await writeHandle.createWritable()
      window.addEventListener('message', async function (event) {
        // Write the contents of the file to the stream.
        await writable.write(event.data + '\n')
        if (links.length) {
          iterateLinks(links)
        } else {
          // Close the file and write the contents to disk.
          await writable.close()
        }
      })
      iterateLinks(links)
    }

    document.body.addEventListener('click', callback)
  }

  requestAnimationFrame(detectList)
  requestAnimationFrame(detectArticle)
})()
