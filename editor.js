let fs = require('fs')
let path = require('path')

let log = console.log

class Stream {
	constructor(initial = undefined) {
		this.listeners = []
		this._value = initial
		this.hasValue = initial !== undefined
	}

	forEach(listener) {
		this.listeners.push(listener)
		if (this.hasValue) {
			listener(this._value)
		}
	}

	get value() {
		return this._value
	}

	set value(newValue) {
		this._value = newValue
		this.hasValue = true
		for (let listener of this.listeners) {
			listener(this._value)
		}
	}
}

function stream(initial = undefined) {
	return new Stream(initial)
}

let globals = {
	// DOM element of editor that is in focus
	editorInFocus: null,

	cursor: {
		x: 0,
		y: 0,
	}
}

// Temporary solution to get changes rendered
function render() {
// TODO
}

// event keyCodes, some of the more popular ones
let keyCodes = {
	9: 'tab',
	40: 'down',
	38: 'up',
	37: 'left',
	39: 'right'
}

let actions = {
	cursorDown: () => {
log('cur down')
		globals.cursor.y++
		render()
	},
	cursorUp: () => {
		globals.cursor.y--
		render()
	},
	cursorLeft: () => {
		globals.cursor.x--
		render()
	},
	cursorRight: () => {
		globals.cursor.x++
		render()
	},
}

function initClassicEditor(filename, selector) {
	let file = fs.readFileSync(filename, 'utf8')
	let humanReadableFilename = path.normalize(filename)

	let editor = document.querySelector(selector)

	editor.value = file

	editor.focus()

	let gotFocus = () => {
		log(`editor classic ${filename}: got focus`)
		document.title = humanReadableFilename
		globals.editorInFocus = editor
	}

	editor.addEventListener('focus', gotFocus)
	editor.focus()
	gotFocus()

	// tab inserts a tab instead of the usual
	editor.addEventListener('keydown', function(e) {
		if (e.keyCode === 9) {
			e.preventDefault()
			let pos = this.selectionStart
			let before = this.value.substring(0, this.selectionStart)
			let after = this.value.substring(this.selectionStart)
			this.value = before + '\t' + after
			this.selectionStart = pos + 1
			this.selectionEnd = pos + 1
		}
	})

	// cmd-s to save
	window.addEventListener('keydown', function(e) {
		if ((window.navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)
			&& e.keyCode === 83
		) {
			e.preventDefault()

			if (editor === globals.editorInFocus) {
				log(`editor classic ${filename}: saving`)
				fs.writeFileSync(filename, editor.value, 'utf8')
				alert(humanReadableFilename + ' saved')
			}
		}
	})
}

// File content is an array of lines
//
// TODO:
// - empty file results in ['']
// - when saving, we should make sure that all lines are terminated
let fileUtils = {
	load(filename) {
		let file = fs.readFileSync(filename, 'utf8')
		let content = file.split('\n')
		return content
	},

	save(filename, content) {
		let file = content.join('\n')
		fs.writeFileSync(filename, file, 'utf8')
	}
}

function initNewEditor(filename, selector) {
	let file = fs.readFileSync(filename, 'utf8')

	let content = fileUtils.load(filename)

	let humanReadableFilename = path.normalize(filename)

	let editor = document.querySelector(selector)

	function render() {
let start = Date.now()
		editor.innerHTML = ''
		for (let line of content) {
			let lineElement = document.createElement('div')
			lineElement.className = 'line'

			for (let char of line) {
				let charElement = document.createElement('div')

				charElement.className = 'char'

				if (char === '\t') {
					char = '    '
					charElement.classList.add('tab')
				}

				charElement.textContent = char
				lineElement.appendChild(charElement)
			}

			editor.appendChild(lineElement)
		}

		let cursor = document.createElement('div')
		cursor.className = 'cursor'

		let cursorX = globals.cursor.x + 'ch'
		// TODO dependency on line height, which is 16 px right now
		let cursorY = globals.cursor.y * 16 + 'px'
		cursor.style.setProperty('--x', cursorX)
		cursor.style.setProperty('--y', cursorY)

		editor.appendChild(cursor)

let end = Date.now()
//log('render', end - start, 'ms')
	}

	render()

// Dirtyyy
setInterval(render, 1000)

	editor.focus()

	let gotFocus = () => {
		log(`editor ${filename}: got focus`)
		document.title = humanReadableFilename
		globals.editorInFocus = editor
	}

	editor.addEventListener('focus', gotFocus)
	editor.focus()
	gotFocus()

	// tab inserts a tab instead of the usual
	editor.addEventListener('keydown', function(e) {
		let key = keyCodes[e.keyCode]

		if (!key) {
			log(`Unknown keyCode ${e.keyCode}`)
		}

		if (key === 'tab') {
			e.preventDefault()
			// TODO implement tab
		}

		if (key === 'down') {
			e.preventDefault()
			actions.cursorDown()
		}

		if (key === 'up') {
			e.preventDefault()
			actions.cursorUp()
		}

		if (key === 'left') {
			e.preventDefault()
			actions.cursorLeft()
		}

		if (key === 'right') {
			e.preventDefault()
			actions.cursorRight()
		}

	})

	// cmd-s to save
	window.addEventListener('keydown', function(e) {
		let key = keyCodes[e.keyCode]

		if (!key) {
			log(`Unknown keyCode ${e.keyCode}`)
		}

		if ((window.navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)
			&& e.keyCode === 83
		) {
			e.preventDefault()

			if (editor === globals.editorInFocus) {
				log(`editor ${filename}: saving, TODO`)
//				fs.writeFileSync(filename, editor.textContent, 'utf8')
//				alert(humanReadableFilename + ' saved')
			}
		}

//		log('!!! down', e.keyCode)
	})
}

initClassicEditor('./editor.js', '.editor.classic')
initNewEditor('./editor.js', '.editor.new')
