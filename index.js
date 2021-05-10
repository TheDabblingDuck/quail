let $ = jQuery = require('jquery')
let Bootstrap = require('bootstrap')
const {ipcRenderer} = require('electron')
const url = require('url')

$('#openbtn').click(function() {
  ipcRenderer.send("index-openbtn-click")
})

ipcRenderer.on('folderpaths', function (event, folderpaths) {
  $('li').remove()
  for (const path of folderpaths) {
    split = url.pathToFileURL(path).toString().split('/')
    foldername = decodeURIComponent(split[split.length-1])
    newrow = `<li path="${path}" class="list-group-item">${foldername}<button class="close"><span class="delete" path="${path}" aria-hidden="true">×</span></button></li>`
    $('.list-group').append(newrow)
  }
  $('li').click(e=>{
    if (e.target.classList.contains('delete')) {
      ipcRenderer.send('index-delete', e.target.getAttribute('path'))
    } else {
      ipcRenderer.send('index-start', e.target.getAttribute('path'))
    }
  })
});
