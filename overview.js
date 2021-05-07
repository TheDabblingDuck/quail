let $ = jQuery = require('jquery')
let Bootstrap = require('bootstrap')
const {ipcRenderer} = require('electron')

let localinfo

$('#navbtn-newblock').click(function() {
  ipcRenderer.send('navto-newblock')
})
$('#navbtn-prevblocks').click(function() {
  ipcRenderer.send('navto-prevblocks')
})
$('#btn-back').click(function() {
  ipcRenderer.send('navto-index')
})

$('#btn-resetqbank').click(function() {
  ipcRenderer.send('resetqbank')
})

ipcRenderer.on('qbankinfo', function (event, qbankinfo) {

  localinfo = qbankinfo

  numblocks = Object.keys(qbankinfo.progress.blockhist).length
  numcorrect = 0
  totalanswered = 0
  completeblocks = 0
  pausedblocks = 0
  totaltime = 0
  for(const i of Object.keys(localinfo.progress.blockhist)) {
    thisblock = qbankinfo.progress.blockhist[i]
    if(thisblock.complete) {
      completeblocks += 1
      totalanswered += thisblock.blockqlist.length
      numcorrect += thisblock.numcorrect
      totaltime += thisblock.elapsedtime
    } else {
      pausedblocks +=1
    }
  }
  numincorrect = totalanswered - numcorrect
  avgtime = totaltime / totalanswered

  numunused = 0
  numall = 0
  numflagged = 0
  i = localinfo.tagnames.tagnames[0]
  for (const j in localinfo.progress.tagbuckets[i]) {
    numunused += localinfo.progress.tagbuckets[i][j].unused.length
    numall += localinfo.progress.tagbuckets[i][j].all.length
    numflagged += localinfo.progress.tagbuckets[i][j].flagged.length
  }
  numseen = numall - numunused

  $('#stat-correct').text(`${numcorrect} (${(100*numcorrect/totalanswered).toFixed(1)}%)`)
  $('#stat-incorrect').text(`${numincorrect} (${(100*numincorrect/totalanswered).toFixed(1)}%)`)
  $('#stat-totalans').text(`${totalanswered}`)
  $('#stat-used').text(`${numseen}/${numall} (${(100*numseen/numall).toFixed(1)}%)`)
  $('#stat-flagged').text(`${numflagged}/${numseen} (${(100*numflagged/numseen).toFixed(1)}%)`)
  $('#stat-totalqs').text(numall)
  $('#stat-completeblocks').text(completeblocks)
  $('#stat-pausedblocks').text(pausedblocks)
  $('#stat-avgtime').text(`${avgtime.toFixed(1)} sec`)
  $('#stat-totaltime').text(`${Math.floor( totaltime / 3600 )} hours, ${Math.floor( (totaltime%3600)/60 )} minutes, ${Math.floor( totaltime%60 )} seconds`)

})
