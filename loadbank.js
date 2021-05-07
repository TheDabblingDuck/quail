let $ = jQuery = require('jquery')
let Bootstrap = require('bootstrap')
const {ipcRenderer} = require('electron')

ipcRenderer.on('addhtml', function (event, html) {
  $('#outputcard').append(html)
})

ipcRenderer.on('done', function (event) {
  $('#okbtn').removeClass('d-none')
  $('#spinner').addClass('d-none')
  $('#okbtn').on('click', function (e) {
    ipcRenderer.send('navto-index')
  })
})
