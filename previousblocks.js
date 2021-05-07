let $ = jQuery = require('jquery')
let Popper = require('popper.js')
let Bootstrap = require('bootstrap')
const {ipcRenderer} = require('electron')

let localinfo

//navbuttons
$('#navbtn-overview').click(function() {
  ipcRenderer.send('navto-overview')
})
$('#navbtn-newblock').click(function() {
  ipcRenderer.send('navto-newblock')
})
$('#btn-back').click(function() {
  ipcRenderer.send('navto-index')
})

//populate table
function populateTable() {

  blockkeys = Object.keys(localinfo.progress.blockhist).sort(function(a, b){return parseInt(b)-parseInt(a)})

  for (const thiskey of blockkeys) {
    thisblock = localinfo.progress.blockhist[thiskey]
    numquestions = thisblock.blockqlist.length
    percentcorrect = (100 * thisblock.numcorrect / numquestions).toFixed(1) + '%'
    if(!thisblock.complete) {
      percentcorrect = '<b><em>Paused</em></b>'
    }
    tagshtml = 'All Subtags'
    if(!thisblock.allsubtagsenabled) {
      tagshtml = `<a href="#" data-toggle="tooltip" data-html="true" container: "body" title="${thisblock.tagschosenstr}">Filtered</a>`
    }
    rowclass = ''
    if(thiskey == localinfo.blockToOpen) {
      if(thisblock.complete) {
        rowclass = 'table-success'
      } else {
        rowclass = 'table-warning'
      }
    }
    rowhtml = `<tr id="row-${thiskey}" class="${rowclass}">
        <td>${ parseInt(thiskey)+1 }</td>
        <td>${ percentcorrect }</td>
        <td><button class="btn btn-link qlistbtn" data-thiskey="${thiskey}" type="button" style="padding: 0px;">${ numquestions }</button></td>
        <td>${ thisblock.qpoolstr }</td>
        <td>${ tagshtml }</td>
        <td>${ thisblock.starttime }</td>
        <td><button class="btn btn-link openbtn" data-thiskey="${thiskey}" type="button" style="padding: 0px;">${thisblock.complete ? 'Review' : 'Resume'}</button></td>
        <td><button class="btn btn-outline-danger deletebtn" data-thiskey="${thiskey}" type="button" style="padding: 0px 4px;font-size: 12px;">✕</button></td>
    </tr>`
    $('#tablebody').append(rowhtml)
  }

  $('.openbtn').on('click', function(e) {
    thiskey = $(e.target).data('thiskey')
    ipcRenderer.send('openblock', thiskey)
  })

  $('.qlistbtn').on('click', function(e) {
    thiskey = $(e.target).data('thiskey')
    $('#qlistModalLabel').text(`Block ${parseInt(thiskey)+1} Question List`)
    $('#qlistModalP').text(localinfo.progress.blockhist[thiskey].blockqlist.toString().replaceAll(',',', '))
    $('#qlistModal').modal('show')
  })

  $('.deletebtn').on('click', function(e) {
    thiskey = $(e.target).data('thiskey')
    if(confirm(`Permanently delete block ${parseInt(thiskey)+1}? Questions will return to the "unused" pool. Incorrects and flags will be lost.`)) {
      $(`#row-${thiskey}`).remove()
      ipcRenderer.send('deleteblock', thiskey)
    }
  })

  //enable tooltips
  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  })

}


// handle qbankinfo
ipcRenderer.on('qbankinfo', function (event, qbankinfo) {

  localinfo = qbankinfo

  populateTable()

})
