let $ = jQuery = require('jquery')
let Bootstrap = require('bootstrap')
const {ipcRenderer} = require('electron')
const Store = require('electron-store');
const store = new Store();

let localinfo
let numtags
tags=[]
subtags = {}
qlist=[]
qpoolSettingToTagbucketsEquiv = {
  'btn-qpool-unused': 'unused',
  'btn-qpool-incorrects': 'incorrects',
  'btn-qpool-flagged': 'flagged',
  'btn-qpool-all': 'all',
  'btn-qpool-custom': 'custom'
}
let tagschosenstr
let allsubtagsenabled

// navigation bar functions
$('#navbtn-overview').click(function() {
  ipcRenderer.send('navto-overview')
})
$('#navbtn-prevblocks').click(function() {
  ipcRenderer.send('navto-prevblocks')
})
$('#btn-back').click(function() {
  ipcRenderer.send('navto-index')
})

// make all button groups work
$('.btn-group').click(function(e) {
  for (const button of e.target.parentElement.children) {
    if (button.id === e.target.id) {
      button.classList.remove('btn-light')
      button.classList.add('btn-primary')
    } else {
      button.classList.remove('btn-primary')
      button.classList.add('btn-light')
    }
  }
})

// handle chnages to qpool button group
$('#div-qpool-customids').addClass('d-none')
$('#btngrp-qpool').click(function(e) {
  if (!e.target.id=='') {
    if (e.target.id == 'btn-qpool-custom') {
        $('#div-qpool-customids').removeClass('d-none')
        $('#tagscard').addClass('d-none')
    } else {
        $('#div-qpool-customids').addClass('d-none')
        $('#tagscard').removeClass('d-none')
    }
    if( tags.length==1 && subtags[tags[0]].length==1 ) {
      $('#tagscard').addClass('d-none')
    }
    store.set('qpool-setting', e.target.id)
    computeSubtagBadgeCounts()
    computeAvailableQuestions()
  }
})


// handle saving and restoring last used Settings
function filterInt(value) {
  if (/^[-+]?(\d+|Infinity)$/.test(value)) {
    return Number(value)
  } else {
    return NaN
  }
}
if(store.has('numq-setting')) {
  $('#textinput-block-numques').val(store.get('numq-setting'))
}
$('#textinput-block-numques').on('input', function() {
  value = $(this).val()
  if (value!='') {
    value = filterInt(value)
    if( isNaN(value) || (value < 1)) {
      $(this).val('')
      store.delete('numq-setting')
      alert('Invalid Value')
    } else {
      store.set('numq-setting', value)
    }
  } else {
    store.delete('numq-setting')
  }
})
if(store.has('timeperq-setting')) {
  $('#textinput-block-timeperq').val(store.get('timeperq-setting'))
}
$('#textinput-block-timeperq').on('input', function() {
  value = $(this).val()
  if (value!='') {
    value = filterInt(value)
    if( isNaN(value) || (value < 1)) {
      $(this).val('')
      store.delete('timeperq-setting')
      alert('Invalid Value')
    } else {
      store.set('timeperq-setting', value)
    }
  } else {
    store.delete('timeperq-setting')
  }
})
if(store.has('showans-setting')) {
  $('#toggle-block-showans').prop('checked', store.get('showans-setting'))
} else {
  store.set('showans-setting', false)
}
$('#toggle-block-showans').change(function(e) {
  store.set('showans-setting', $(this).prop('checked'))
})
if(store.has('sequential-setting')) {
  $('#toggle-block-sequential').prop('checked', store.get('sequential-setting'))
} else {
  store.set('sequential-setting', false)
}
$('#toggle-block-sequential').change(function(e) {
  store.set('sequential-setting', $(this).prop('checked'))
})

// handle timed button
$('#toggle-block-timed').change(function(e){
  if (e.target.checked) {
    $('#timed-info').removeClass('d-none')
    store.set('timed-setting', true)
  } else {
    $('#timed-info').addClass('d-none')
    store.set('timed-setting', false)
  }
})
if(store.has('timed-setting')) {
  if(store.get('timed-setting')==false) {
    $('#toggle-block-timed').click()
  }
} else {
  store.set('timed-setting', true)
}

// start button animation and function
$('#btn-startblock').get(0).animate([
  // keyframes
  { transform: 'scale(0.98)' },
  { transform: 'scale(1.02)' },
  { transform: 'scale(0.98)' }
], {
  // timing options
  duration: 2000,
  iterations: Infinity
});
function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        throw new RangeError("getRandom: more elements taken than available");
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}
$('#btn-startblock').on('click', function(e) {
  numq = store.get('numq-setting')
  timeperq = store.get('timeperq-setting')
  istimed = store.get('timed-setting')
  if( numq==undefined || ( istimed==true && timeperq==undefined ) ) {
    alert('Invalid Settings')
  } else {
    if ( numq > qlist.length ) {
      alert(`A ${numq} question block was requested, but only ${qlist.length} questions are available with the current settings.`)
    } else {
      store.set('recent-tagschosenstr', tagschosenstr)
      store.set('recent-allsubtagsenabled', allsubtagsenabled)
      //sequential or random
      if(store.get('sequential-setting')) {
        qlist.sort(function (a, b) {
          return parseInt(a) - parseInt(b)
        })
        blockqlist = qlist.slice(0, numq)
      } else {
        blockqlist = getRandom(qlist, numq)
      }
      //handle paired questions
      blockqlist = handleGrouped(blockqlist)
      if(blockqlist.length != numq) {
        alert(`A ${blockqlist.length} question block was necessary due to the inclusion of grouped questions.`)
      }
      ipcRenderer.send('startblock', blockqlist)
    }
  }
})

function getPrev(qid) {
  if(Object.keys(localinfo.groups).includes(qid)) {
    return localinfo.groups[qid].prev
  } else {
    return null
  }
}
function getNext(qid) {
  if(Object.keys(localinfo.groups).includes(qid)) {
    return localinfo.groups[qid].next
  } else {
    return null
  }
}
function handleGrouped(blockqlist) {

  desiredlength = blockqlist.length

  for(i=0; i<blockqlist.length; i++) {
    next = getNext(blockqlist[i])
    if(next) {
      for(j=0;j<blockqlist.length;j++) {
        if(blockqlist[j]==next) {
          blockqlist.splice(j,1)
          j = j-1
        }
      }
      blockqlist.splice(i+1,0,next)
    }
  }

  for(i=blockqlist.length-1;i>=0;i--) {
    prev = getPrev(blockqlist[i])
    if(prev) {
      for(j=0;j<blockqlist.length;j++) {
        if(blockqlist[j]==prev) {
          blockqlist.splice(j,1)
          j = j-1
        }
      }
      blockqlist.splice(i,0,prev)
      i = i+1
    }
  }

  numtocut = blockqlist.length - desiredlength

  i=0;
  while(i<blockqlist.length && numtocut>0) {
    moveforward = true
    j = numtocut-1
    while(numtocut>0 && j>=0) {
      if(getPrev(blockqlist[i])==null && getNext(blockqlist[i+j])==null) {
        blockqlist.splice(i,j+1)
        numtocut = numtocut - (j+1)
        moveforward = false
      }
      j = Math.min(j-1, numtocut-1)
    }
    if(moveforward) {
      i = i+1
    }
  }

  return blockqlist

}

$('#textarea-qpool-customids').on('focusout', function(e) {
  computeAvailableQuestions()
})

//function to compute available questions
function computeAvailableQuestions() {

  tagschosenstr = ''
  allsubtagsenabled = true

  qpoolToUse = qpoolSettingToTagbucketsEquiv[store.get('qpool-setting')]
  if(qpoolToUse!='custom') {
    for (var i = 0; i<numtags; i++) {
      tagschosenstr = tagschosenstr + '<b><u>' + tags[i] + ':</u></b> '
      tagqlist = []
      numsubtags = subtags[tags[i]].length
      allSubtagsEnabled = $(`#allsubtags-${i}`).prop('checked')
      if(allSubtagsEnabled) {
        tagschosenstr = tagschosenstr + 'All Subtags, '
      } else {
        allsubtagsenabled = false
      }
      for(var j=0; j<numsubtags; j++) {
        subtagqlist = localinfo.progress.tagbuckets[tags[i]][subtags[tags[i]][j]][qpoolToUse]
        if( allSubtagsEnabled || ($(`#subtagCheck-${i}-${j}`).prop('checked')) ) {
          tagqlist = tagqlist.concat(subtagqlist)
          if(!allSubtagsEnabled) {
            tagschosenstr = tagschosenstr + subtags[tags[i]][j] + ', '
          }
        }
      }
      if(i==0) {
        qlist = tagqlist
      } else {
        qlist = $.map(qlist,function(a){return $.inArray(a, tagqlist) < 0 ? null : a;})
      }
      tagschosenstr = tagschosenstr + '<br />'
    }
  } else {
    // handle custom qpool
    qlist = []
    try {
      idstr = $('#textarea-qpool-customids').val()
      idstr = idstr.replace(/ /g, '')
      customlist = idstr.split(',')
      for (var i = customlist.length; i--; ) {
          if (customlist[i] === '') {
              customlist.splice(i, 1);
          }
      }
      qindex = Object.keys(localinfo.index)
      for(const customid of customlist) {
        if(!qindex.includes(customid)) {
          var e = new Error(`Question ID "${customid}" not found in qbank.`);
          throw e;
        }
      }
      qlist = customlist
    } catch (e) {
      alert('Error parsing question list: '+e)
    }
  }

  $('#numAvailableQues').text(qlist.length)

}

//function to fill out pool badges
function makePoolBadges() {

  numUnused = 0
  numIncorrects = 0
  numFlagged = 0
  numAll = 0
  numsubtags = subtags[tags[0]].length
  for(var j=0; j<numsubtags; j++) {
    numUnused += localinfo.progress.tagbuckets[tags[0]][subtags[tags[0]][j]]['unused'].length
    numIncorrects += localinfo.progress.tagbuckets[tags[0]][subtags[tags[0]][j]]['incorrects'].length
    numFlagged += localinfo.progress.tagbuckets[tags[0]][subtags[tags[0]][j]]['flagged'].length
    numAll += localinfo.progress.tagbuckets[tags[0]][subtags[tags[0]][j]]['all'].length
  }

  function getPoolBadge(num) {
    return `&nbsp;&nbsp;<span class="badge badge-pill badge-secondary">${num}</span>`
  }
  $('#btn-qpool-unused').append(getPoolBadge(numUnused))
  $('#btn-qpool-incorrects').append(getPoolBadge(numIncorrects))
  $('#btn-qpool-flagged').append(getPoolBadge(numFlagged))
  $('#btn-qpool-all').append(getPoolBadge(numAll))

}

// compute subtag badge counts
function computeSubtagBadgeCounts() {
  qpoolToUse = qpoolSettingToTagbucketsEquiv[store.get('qpool-setting')]
  if(qpoolToUse!='custom') {
    for (var i = 0; i<numtags; i++) {
      numsubtags = subtags[tags[i]].length
      for(var j=0; j<numsubtags; j++) {
        badgetext = localinfo.progress.tagbuckets[tags[i]][subtags[tags[i]][j]][qpoolToUse].length
        $(`#subtagBadge-${i}-${j}`).text(badgetext)
      }
    }
  } else {
    $('.subtagBadge').text('')
  }
}

//function to populate tags section
function populateTagsArea() {

  //create accordion for each tagname
  function accordionItem(tagnum, tagname) {
    accitemnum = tagnum + 1
    return `<div class="card">
        <div class="card-header" role="tab">
            <h5 class="mb-0"><a data-toggle="collapse" aria-expanded="false" aria-controls="accordion-tags .item-${accitemnum}" href="#accordion-tags .item-${accitemnum}">${tagname}</a></h5>
        </div>
        <div class="collapse item-${accitemnum}" role="tabpanel" data-parent="#accordion-tags">
            <div id="accordionCard-${accitemnum}" class="card-body">
              <div class="custom-control custom-switch">
                <input type="checkbox" class="custom-control-input allSubtagCheck" data-tagnum="${tagnum}" disabled checked="" id="allsubtags-${tagnum}" />
                <label class="custom-control-label" for="allsubtags-${tagnum}">All Subtags</label>
              </div>
              <hr />
            </div>
        </div>
    </div>`
  }
  for (var i = 0; i<numtags; i++) {
    $('#accordion-tags').append(accordionItem(i, tags[i]))
  }

  //populate subtags within accordion
  function subtagToggleHtml(tagnum, subnum, text) {
    return `<div class="custom-control custom-switch">
      <input type="checkbox" class="custom-control-input subtagCheck subtagCheck-Tag${tagnum}" data-tagnum="${tagnum}" data-subnum="${subnum}" id="subtagCheck-${tagnum}-${subnum}" />
      <label class="custom-control-label d-md-flex align-items-md-center" for="subtagCheck-${tagnum}-${subnum}">
        ${text}
        &nbsp;<span id="subtagBadge-${tagnum}-${subnum}" class="badge badge-pill badge-secondary subtagBadge"></span>
      </label>
    </div>`
  }
  for (var i = 0; i<numtags; i++) {
    numsubtags = subtags[tags[i]].length
    for(var j=0; j<numsubtags; j++) {
      $(`#accordionCard-${i+1}`).append(subtagToggleHtml(i, j, subtags[tags[i]][j]))
    }
  }
  computeSubtagBadgeCounts()

  // handle checking Subtags
  var keepAccordionOpen = false
  function isAllTags() {
    allchecked = true
    for (const c of $('.allSubtagCheck')) {
      allchecked = allchecked && c.checked
    }
    if(allchecked) {
      keepAccordionOpen = true
      $('#btn-tags-all').click()
    }
  }
  $('#btn-tags-all').on('click', function (e) {
    $('.allSubtagCheck').prop('checked', true)
    $('.subtagCheck').prop('checked', false)
    if(!keepAccordionOpen) {
      $('.collapse').collapse('hide')
    }
    keepAccordionOpen = false
    $('#btn-tags-filtered').get(0).disabled=true
    computeAvailableQuestions()
  })
  $('.subtagCheck').change(function(e) {
    tagnum = $(this).data('tagnum')
    if($(this).prop('checked')) {
      $(`#allsubtags-${tagnum}`).prop('checked', false)
      $(`#allsubtags-${tagnum}`).get(0).disabled=false
      $('#btn-tags-filtered').click()
      $('#btn-tags-filtered').get(0).disabled=false
    } else {
      anychecked = false
      for (const c of $(`.subtagCheck-Tag${tagnum}`)) {
        anychecked = anychecked || c.checked
      }
      if(!anychecked) {
        $(`#allsubtags-${tagnum}`).prop('checked', true)
        $(`#allsubtags-${tagnum}`).get(0).disabled=true
        isAllTags()
      }
    }
    computeAvailableQuestions()
  })
  $('.allSubtagCheck').change(function(e) {
    tagnum = $(this).data('tagnum')
    if($(this).prop('checked')) {
      $(`.subtagCheck-Tag${tagnum}`).prop('checked', false)
      $(this).get(0).disabled=true
      isAllTags()
    }
    computeAvailableQuestions()
  })

}

// handle actions dependent on qbankinfo
ipcRenderer.on('qbankinfo', function (event, qbankinfo) {

  localinfo = qbankinfo

  //initialize variables
  numtags = Object.keys(localinfo.tagnames.tagnames).length
  for (var i=0; i<numtags; i++) {
    tagname = localinfo.tagnames.tagnames[i]
    tags.push(tagname)
    subtags[tagname] = Object.keys(localinfo.progress.tagbuckets[tagname]).sort()
  }

  if(!store.has('qpool-setting')) {
    store.set('qpool-setting', 'btn-qpool-unused')
  }
  btnid = store.get('qpool-setting')

  makePoolBadges()

  populateTagsArea()

  $('.badge').click(function (e){
    e.target.parentElement.click()
  })

  //clicking a button ends up running computeAvailableQuestions()
  $(`#${btnid}`).click()

  $('#spinner').remove()
  $('#pagecontent').removeClass('d-none')

})
