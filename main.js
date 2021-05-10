const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')
const dirTree = require("directory-tree")
const sanitizeHtml = require('sanitize-html')
const url = require('url')
const { v4: uuidv4 } = require('uuid')
const axios = require('axios').default
const store = new Store();
Store.initRenderer();


let win
let sendinfo
folderpaths = []
currentpath = ''
qbankinfo = {}
doiquit = false


//GA tracking
let uuid
if( store.has('uuid') ) {
  uuid = store.get('uuid')
} else {
  uuid = uuidv4()
  store.set('uuid', uuid)
}
function gaPageview(pagename) {
  const payload = new URLSearchParams({
      v: 1,
      cid: uuid,
      tid: 'UA-171633786-3',
      t: 'pageview',
      dp: `/${pagename}.html`,
      dt: pagename
  }).toString()
  axios.post('https://google-analytics.com/collect', payload)
}
function gaEvent(eventname) {
  const payload = new URLSearchParams({
    v: 1,
    cid: uuid,
    tid: 'UA-171633786-3',
    t: 'event',
    ec: eventname,
    ea: eventname
  }).toString();
  axios.post('https://google-analytics.com/collect', payload);
}
ipcMain.on("answerselect", (e)=>{
  gaEvent('answerselect')
})


if (store.has('folderpaths')) {
  folderpaths = (store.get(folderpaths))['folderpaths']
}


function createWindow () {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  })

  win.setTitle('Quail')
  sendinfo = function() {
    win.webContents.send('folderpaths', folderpaths)
  }
  win.webContents.on('did-finish-load', () => {
    sendinfo()
  })
  win.loadFile('index.html')
  gaPageview('index')
}

function appquit() {
  win.destroy()
  app.quit()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  const { powerMonitor } = require('electron')
  function considerPause() {
    const currentURL = win.webContents.getURL()
    if(currentURL.endsWith('examview.html')) {
      win.webContents.send('dopause')
    } else {
      if(doiquit) {
        appquit()
      }
    }
  }

  powerMonitor.on('suspend', () => { considerPause() })
  powerMonitor.on('lock-screen', () => { considerPause() })
  powerMonitor.on('user-did-resign-active', () => { considerPause() })
  powerMonitor.on('shutdown', (e) => {
    e.preventDefault()
    doiquit = true
    considerPause()
  })
  win.on('close', (e) => {
    e.preventDefault()
    doiquit = true
    considerPause()
  })
  win.on('session-end', (e) => {
    e.preventDefault()
    doiquit = true
    considerPause()
  })

})


function processNewBank(pathgiven) {

  win.webContents.send('addhtml', `<div>Reading folder: ${pathgiven}</div><br />`)

  tree = dirTree(pathgiven, {extensions:/\.html$/})

  qidobj = {}
  nosolution = []

  if(! fs.existsSync(pathgiven + '/index.json')) {
    for( const c of tree.children ) {
      if(c.type=='file' && c.name.endsWith('-q.html')) {
        solutionfile = c.name.split('-')[0] + '-s.html'
        if( fs.existsSync(pathgiven + '/' + solutionfile) ) {
          qidobj[c.name.split('-')[0]] = {0: 'General'}
        } else {
          nosolution.push(c.name.split('-')[0])
        }
      }
    }
  } else {
    qidobj = JSON.parse(fs.readFileSync(pathgiven+'/index.json'))
  }

  if( Object.keys(qidobj).length > 0 ) {

    if(! fs.existsSync(pathgiven + '/index.json')) {
      //write index
      fs.writeFile(pathgiven + '/index.json', JSON.stringify(qidobj), (err) => {
           if(err) { console.log(err)}
           else { console.log(`Generated index.json with ${Object.keys(qidobj).length} questions`) }
      })
      //write tag names
      tagnamesobj = {
        'tagnames' : {
          0: 'General'
        }
      }
      fs.writeFile(pathgiven + '/tagnames.json', JSON.stringify(tagnamesobj), (err) => {
           if(err) { console.log(err)}
           else { console.log(`Generated tagnames.json`) }
      })
      win.webContents.send('addhtml', `<div style="${nosolution.length>0 ? 'color: red;' : ''}">Index file automatically generated - ${Object.keys(qidobj).length} questions included.${nosolution.length>0 ? ' Question IDs ' + nosolution.toString().replaceAll(',',', ') + ' were omitted as no corresponding solution file was found.' : '' }</div><br />`)
    } else {
      win.webContents.send('addhtml', `<div>Index file found with ${Object.keys(qidobj).length} questions.</div><br />`)
    }

    //write groups if no file
    if(! fs.existsSync(pathgiven + '/groups.json')) {
      groupsobj = {}
      fs.writeFile(pathgiven + '/groups.json', JSON.stringify(groupsobj), (err) => {
           if(err) { console.log(err)}
           else {
             console.log(`Generated groups.json`)
           }
      })
      win.webContents.send('addhtml', `<div>Automatically generated empty groups.json file</div><br />`)
    } else {
      win.webContents.send('addhtml', `<div>Found existing groups.json file</div><br />`)
    }

    //write panes if no file
    if(! fs.existsSync(pathgiven + '/panes.json')) {
      panesobj = {}
      fs.writeFile(pathgiven + '/panes.json', JSON.stringify(panesobj), (err) => {
           if(err) { console.log(err)}
           else {
             console.log(`Generated panes.json`)
           }
      })
      win.webContents.send('addhtml', `<div>Automatically generated empty panes.json file</div><br />`)
    } else {
      win.webContents.send('addhtml', `<div>Found existing panes.json file</div><br />`)
    }

    // write choices if no file
    if(! fs.existsSync(pathgiven + '/choices.json')) {
      choicesobj = {}
      problems = false
      prob1str = 'Problem detecting answer choices on QIDs: '
      prob2str = 'Problem detecting correct answer on QIDs: '
      prob3str = 'Correct answer not found in choice list on QIDs: '
      // regexchoice = /\n*[A-Z][ \n]*\)|\n*[A-Z]\./gm
      regexchoice = /^[  \t]*[A-Z][  \n\t]*\)|^[  \t]*[A-Z]\./gm
      regexcorrect = /[Cc]orrect[  \n]*[Aa]nswer[  \n]*[\.:][  \n]*[A-Z]/gm
      for(const thisqid of Object.keys(qidobj)) {
        // console.log('reading: ' + `/${thisqid}-q.html`)
        file = fs.readFileSync(pathgiven+`/${thisqid}-q.html`, 'utf8')
        matchlist = sanitizeHtml(file, {allowedTags:['br'], allowedAttributes:[]}).replace(/<br *\/*>/g, '\n').match(regexchoice)
        choicelist = []
        if(matchlist) {
          for(const choice of matchlist) {
            choicelist.push(choice.match(/[A-Z]/)[0])
          }
        } else {
          problems = true
          prob1str = prob1str + thisqid.toString() + ', '
        }
        // console.log('reading: ' + `/${thisqid}-s.html`)
        file = fs.readFileSync(pathgiven+`/${thisqid}-s.html`, 'utf8')
        matchlist = sanitizeHtml(file, {allowedTags:[], allowedAttributes:[]}).match(regexcorrect)
        if(matchlist) {
          correctstr = matchlist[0].substring(matchlist[0].length-1)
        } else {
          problems = true
          prob2str = prob2str + thisqid.toString() + ', '
          correctstr = ''
        }
        if(!choicelist.includes(correctstr) && correctstr!='' && choicelist.length>0) {
          problems = true
          prob3str = prob3str + thisqid.toString() + ', '
        }
        item = {
          'options': choicelist,
          'correct': correctstr
        }
        choicesobj[thisqid] = item
      }
      fs.writeFile(pathgiven + '/choices.json', JSON.stringify(choicesobj), (err) => {
           if(err) { console.log(err)}
           else { console.log(`Generated choices.json with ${Object.keys(choicesobj).length} items`) }
      })
      win.webContents.send('addhtml', `<div>The file 'choices.json' containing answer choices and correct answers was not found, so it is being automatically generated based on the question and solution text. Choices and scoring may be unreliable.</div>`)
      if(problems) {
        win.webContents.send('addhtml', `<div style="color: red;">One or more problems were detected in this process.<br />${prob1str}<br />${prob2str}<br />${prob3str}</div><br />`)
      } else {
        win.webContents.send('addhtml', `<div>No problems were detected in this process.</div><br />`)
      }
    } else {
      win.webContents.send('addhtml', `<div>Found existing choices.json file</div><br />`)
    }

    //handle progress file
    if(fs.existsSync(pathgiven + '/progress.json')) {
      useprog = dialog.showMessageBoxSync(win, {message: 'Progress file found. Continue using progress file, or reset progress?', type: 'question', buttons: ['Use progress file', 'Reset progress'], defaultId: 0})
      if(useprog == 1) {
        fs.unlinkSync(pathgiven + '/progress.json')
        win.webContents.send('addhtml', `<div>Deleted progress.json file - question bank has been reset</div><br />`)
        console.log('Deleted existing progress file')
      } else {
        win.webContents.send('addhtml', `<div>Retained existing progress.json file</div><br />`)
        console.log('Retained existing progress file')
      }
    }

    folderpaths.push(pathgiven)
    store.set('folderpaths', folderpaths)
    // win.webContents.send('folderpaths', folderpaths)

  } else {
    win.webContents.send('addhtml', `<div style="color: red;">Invalid folder - no properly formatted files detected</div><br />`)
  }

  win.webContents.send('addhtml', `<div>Done.</div><br />`)
  win.webContents.send('done')

}


ipcMain.on("index-openbtn-click",(e)=>{
  pathgiven = dialog.showOpenDialogSync(win, { properties: ['openDirectory'], message: 'Select qbank folder' })
  if (pathgiven != undefined) {
    pathgiven = pathgiven[0]

    if(! folderpaths.includes(pathgiven)) {

      sendinfo = function() {
        processNewBank(pathgiven)
      }

      win.loadFile('loadbank.html')
      gaPageview('loadbank')

    } else {
      dialog.showMessageBoxSync(win, {message: 'Folder already added', type:'error'})
    }


  }

})

ipcMain.on('resetqbank', (e) => {
  useprog = dialog.showMessageBoxSync(win, {message: 'Are you sure you want to delete all progress and reset this qbank?', type: 'question', buttons: ['Cancel', 'Reset'], defaultId: 0})
  if(useprog == 1) {
    fs.unlinkSync(currentpath + '/progress.json')
    loadqbank()
  }
})

function createTagBuckets() {

  numtags = Object.keys(qbankinfo.tagnames.tagnames).length
  tags=[]
  for (var i=0; i<numtags; i++) {
    tagname = qbankinfo.tagnames.tagnames[i]
    tags.push(tagname)
    qbankinfo.progress.tagbuckets[tagname] = {}
  }

  for (const qid in qbankinfo.index) {
    for(var i=0; i<numtags; i++) {
      subtagname = qbankinfo.index[qid][i]
      if (subtagname in qbankinfo.progress.tagbuckets[tags[i]]) {
        qbankinfo.progress.tagbuckets[tags[i]][subtagname].all.push(qid)
        qbankinfo.progress.tagbuckets[tags[i]][subtagname].unused.push(qid)
      } else {
        qbankinfo.progress.tagbuckets[tags[i]][subtagname] = {
          'all': [qid],
          'unused': [qid],
          'incorrects': [],
          'flagged': []
        }
      }
    }
  }

}

function loadFolderInfo() {

  qbankinfo.path =  currentpath
  qbankinfo.index = JSON.parse(fs.readFileSync(currentpath+'/index.json'))
  qbankinfo.tagnames = JSON.parse(fs.readFileSync(currentpath+'/tagnames.json'))
  qbankinfo.choices = JSON.parse(fs.readFileSync(currentpath+'/choices.json'))
  qbankinfo.groups = JSON.parse(fs.readFileSync(currentpath+'/groups.json'))
  qbankinfo.panes = JSON.parse(fs.readFileSync(currentpath+'/panes.json'))

  if(fs.existsSync(currentpath + '/progress.json')) {
    qbankinfo.progress = JSON.parse(fs.readFileSync(currentpath+'/progress.json'))
  } else {
    numquestions = Object.keys(qbankinfo.index).length
    qbankinfo.progress = {
      'blockhist': {

      },
      'tagbuckets': {

      }
    }
    createTagBuckets()
    fs.writeFile(currentpath + '/progress.json', JSON.stringify(qbankinfo.progress), (err) => {
         if(err)
            console.log(err)
    })
  }

}

function loadqbank() {
  loadFolderInfo()

  sendinfo = function() {
    win.webContents.send('qbankinfo', qbankinfo)
    split = url.pathToFileURL(currentpath).toString().split('/')
    foldername = decodeURIComponent(split[split.length-1])
    win.setTitle(`Quail - ${foldername}`)
  }

  win.loadFile('overview.html')
  gaPageview('overview')
}

ipcMain.on("index-start", (e, clickedpath)=>{
  currentpath = clickedpath
  if(fs.existsSync(currentpath + '/index.json')) {
    loadqbank()
  } else {
    dialog.showMessageBox(win, {message: 'Invalid folder - no index.json file', type:'error'})
  }
})

ipcMain.on("index-delete", (e, path)=>{
  index = folderpaths.indexOf(path)
  folderpaths.splice(index, 1)
  store.set('folderpaths', folderpaths)
  win.webContents.send('folderpaths', folderpaths)
})

ipcMain.on("navto-overview", (e)=>{
  win.loadFile('overview.html')
  gaPageview('overview')
})

ipcMain.on("navto-newblock", (e)=>{
  win.loadFile('newblock.html')
  gaPageview('newblock')
})

ipcMain.on("navto-prevblocks", (e)=>{
  win.loadFile('previousblocks.html')
  gaPageview('previousblocks')
})

ipcMain.on("navto-index", (e)=>{
  sendinfo = function() {
    win.webContents.send('folderpaths', folderpaths)
  }
  win.loadFile('index.html')
  win.setTitle(`Quail`)
  gaPageview('index')
})

// bucket helper functions
function isInBucket(thisqid, bucket) {
  return qbankinfo.progress.tagbuckets[qbankinfo.tagnames.tagnames[0]][qbankinfo.index[thisqid][0]][bucket].includes(thisqid)
}
function addToBucket(thisqid, bucket) {
  numtags = Object.keys(qbankinfo.tagnames.tagnames).length
  for(var i=0; i<numtags; i++) {
    qbankinfo.progress.tagbuckets[qbankinfo.tagnames.tagnames[i]][qbankinfo.index[thisqid][i]][bucket].push(thisqid)
  }
}
function removeFromBucket(thisqid, bucket) {
  numtags = Object.keys(qbankinfo.tagnames.tagnames).length
  for(var i=0; i<numtags; i++) {
    var index = qbankinfo.progress.tagbuckets[qbankinfo.tagnames.tagnames[i]][qbankinfo.index[thisqid][i]][bucket].indexOf(thisqid);
    if (index > -1) {
      qbankinfo.progress.tagbuckets[qbankinfo.tagnames.tagnames[i]][qbankinfo.index[thisqid][i]][bucket].splice(index, 1);
   }
  }
}


qpoolSettingEquiv = {
  'btn-qpool-unused': 'Unused',
  'btn-qpool-incorrects': 'Incorrects',
  'btn-qpool-flagged': 'Flagged',
  'btn-qpool-all': 'All',
  'btn-qpool-custom': 'Custom'
}
ipcMain.on("startblock", (e, blockqlist)=>{

  for(const thisqid of blockqlist) {
    if( isInBucket(thisqid, 'unused') ) {
      removeFromBucket(thisqid, 'unused')
    }
  }

  newblockkey = Object.keys(qbankinfo.progress.blockhist).length.toString()
  timelimit = -1
  if(store.get('timed-setting')) {
    timelimit = parseInt(store.get('timeperq-setting')) * blockqlist.length
  }
  qbankinfo.progress.blockhist[newblockkey] = {
    'blockqlist': blockqlist,
    'answers': Array(blockqlist.length).fill(''),
    'highlights': Array(blockqlist.length).fill('[]'),
    'complete': false,
    'timelimit': timelimit,
    'elapsedtime': 0,
    'numcorrect': 0,
    'qpoolstr': qpoolSettingEquiv[store.get('qpool-setting')],
    'tagschosenstr': store.get('recent-tagschosenstr'),
    'allsubtagsenabled': store.get('recent-allsubtagsenabled'),
    'starttime': (new Date()).toLocaleString(),
    'currentquesnum': 0,
    'showans': store.get('showans-setting')
  }
  qbankinfo.blockToOpen = newblockkey
  win.loadFile('examview.html')
  gaEvent('startblock')

})

ipcMain.on("pauseblock", (e, progress)=>{
  qbankinfo.progress = progress
  fs.writeFile(currentpath + '/progress.json', JSON.stringify(qbankinfo.progress), (err) => {
    if(err) {
      console.log(err)
    } else {
      if(doiquit) {
        appquit()
      }
    }
  })

  if(win) {
    win.loadFile('previousblocks.html')
    function clearblocktoopen() {
      if(win) {
        qbankinfo.blockToOpen = ''
      }
    }
    setTimeout(clearblocktoopen, 500)
  }

})

ipcMain.on("openblock", (e, thiskey)=>{
  qbankinfo.blockToOpen = thiskey
  win.loadFile('examview.html')
  gaEvent('openblock')
})

ipcMain.on("deleteblock", (e, thiskey)=>{
  thisqlist = qbankinfo.progress.blockhist[thiskey].blockqlist
  for(var i=0; i<thisqlist.length; i++) {
    thisqid = thisqlist[i]
    if( isInBucket(thisqid, 'incorrects') ) {
      removeFromBucket(thisqid, 'incorrects')
    }
    if( isInBucket(thisqid, 'flagged') ) {
      removeFromBucket(thisqid, 'flagged')
    }
    addToBucket(thisqid, 'unused')
  }
  delete qbankinfo.progress.blockhist[thiskey]
  fs.writeFile(currentpath + '/progress.json', JSON.stringify(qbankinfo.progress), (err) => {
       if(err)
          console.log(err)
  })
})







//
