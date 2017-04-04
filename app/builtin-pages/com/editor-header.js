import * as yo from 'yo-yo'
import mime from 'mime'
import renderDropdownMenuBar from './dropdown-menu-bar'
import {niceDate} from '../../lib/time'

// exported api
// =

export function update (archive, path, activeUrl, isActiveFileDirty) {
  if (!archive) {
    return ''
  }
  path = path || ''
      // <span class="save-prompt">${isDirty ? 'Save changes' : ''}</span> TODO
      // <button
      //   ${!isDirty ? 'disabled' : ''}
      //   onclick=${e => onSaveFile(path, url)}
      //   class="save"
      //   title="Save This File's Changes">
      //   <i class="fa fa-save"></i>
      // </button>
      // <button title="Open File In New Window" onclick=${e => onOpenInNewWindow(e, url)}>
      //   <i class="fa fa-external-link"></i>
      // </button>
  return yo.update(document.querySelector('.editor-header'), yo`
    <header class="editor-header">
      <div class="main">
        <div class="path">
          ${rArchiveName(archive)}
          ${rFilePath(path)}
        </div>
        ${rMenu(archive, path)}
        <span class="last-updated">Updated ${niceDate(archive.info.mtime)}</span>
      </div>
      ${rActions(path, activeUrl, isActiveFileDirty)}
    </header>`)
}

// renderers
// =

function rArchiveName (archive) {
  return yo`<div class="archive">${archive.niceName}</div>`
}

function rFilePath (path) {
  if (!path) {
    return ''
  }

  var label = (path.startsWith('buffer~~')) ? 'New file' : path
  return yo`
    <div class="file">
      <i class="fa fa-angle-right"></i>
      ${rFileIcon(path)}
      ${label}
    </div>
  `
}

function rMenu (archive, path) {
  return renderDropdownMenuBar([
    {
      label: 'File',
      menu: [
        {label: 'Create new site'},
        {label: 'New file'},
        {label: 'New folder'},
        {label: 'Import file(s)...'},
        {label: 'Save'}
      ]
    },
    {
      label: 'Edit',
      menu: [
        {label: 'Edit site details...'},
        '-',
        {label: 'Undo'},
        {label: 'Redo'},
        '-',
        {label: 'Cut'},
        {label: 'Copy'},
        {label: 'Paste'}
      ]
    },
    {
      label: 'Tools',
      menu: [
        {label: 'Fork this site'},
        {label: 'Delete this site'},
        {label: 'Settings'}
      ]
    }
  ])
}

function rActions (path, url, isDirty) {
  return yo`
    <div class="actions">
      <a class="btn primary"><i class="fa fa-link"></i> Share</a>
    </div>
  `
}

function rFileIcon (path) {
  // lookup the mimetype
  var mimetype = mime.lookup(path)
  var cls = 'file-o'

  if (mimetype.startsWith('image/')) {
    cls = 'file-image-o'
  } else if (mimetype.startsWith('video/')) {
    cls = 'file-video-o'
  } else if (mimetype.startsWith('video/')) {
    cls = 'file-video-o'
  } else if (mimetype.startsWith('audio/')) {
    cls = 'file-audio-o'
  } else if (mimetype.startsWith('text/html')) {
    cls = 'file-code-o'
  } else if (mimetype.startsWith('text/')) {
    cls = 'file-text-o'
  }

  return yo`<i class="fa fa-${cls}"></i>`
}

function onSaveFile (path, url) {
  // dispatch an app event
  var evt = new Event('save-file')
  evt.detail = { path: path, url: url}
  window.dispatchEvent(evt)
}

function onOpenInNewWindow (e, url) {
  e.preventDefault()
  e.stopPropagation()
  beakerBrowser.openUrl(url)
}
