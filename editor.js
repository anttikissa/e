let fs = require('fs')
let path = require('path')

let log = console.log

function error(...args) {
	log('Error:', ...args)
}

class Stream {
	constructor(initial = undefined) {
		this.listeners = []
		this._value = initial
		this.hasValue = initial !== undefined
	}

	forEach(listener) {
		this.addListener(listener)
		if (this.hasValue) {
			listener(this._value)
		}
	}

	addListener(listener) {
		this.listeners.push(listener)
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

	// Allows the stream to be used as value in contexts like
	// 'value is ' + stream(123)
	// => 'value is 123'
	valueOf() {
		return this._value
	}
}

function stream(initial = undefined) {
	return new Stream(initial)
}

stream.combine = function(...streams) {
	let result = stream()
	result.pull = function() {
		if (streams.every(s => s.hasValue)) {
			this.value = streams.map(s => s.value)
		}
	}

	for (let s of streams) {
		s.addListener(function() {
			result.pull()
		})
	}

	result.pull()

	return result
}

let globals = {
	// DOM element of editor that is in focus
	editorInFocus: null,

	// Events stream of changes to file. [startLine, endLine] indicates
	// range of lines that should be rerendered. (A bit prematurely
	// optimized here?)
	fileChangeEvents: stream([0, Infinity]),

	cursor: {
		x: stream(0),
		y: stream(0),
	}
}

let actions = {
	cursorDown: () => {
		globals.cursor.y.value++
	},
	cursorUp: () => {
		globals.cursor.y.value--
	},
	cursorLeft: () => {
		globals.cursor.x.value--
	},
	cursorRight: () => {
		globals.cursor.x.value++
	},
	backspace: (content) => {
		// TODO
	}
}

// Modify content by inserting a character 'character' at the current cursor position
// Should be an action?
function insert(content, character) {
	let lineNumber = globals.cursor.y.value
	let columnNumber = globals.cursor.x.value
	
	let line = content[lineNumber]
	if (!line) {
		error('No line at cursor position')
	}

	let start = line.substring(0, columnNumber)
	let end = line.substring(columnNumber)
	content[lineNumber] = start + character + end
	globals.cursor.x.value += character.length

	globals.fileChangeEvents.value = [lineNumber, lineNumber]
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
	editor.addEventListener('keydown', function(e) {
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
		fs.writeFileSync(filename + '-test', file, 'utf8')
	}
}

function initNewEditor(filename, selector) {
	let file = fs.readFileSync(filename, 'utf8')

	let content = fileUtils.load(filename)

	let humanReadableFilename = path.normalize(filename)

	let editor = document.querySelector(selector)
	let textElement = editor.querySelector('.text')

	function render() {
		let start = Date.now()

		textElement.innerHTML = ''
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

			textElement.appendChild(lineElement)
		}

		renderCursor(globals.cursor.x.value, globals.cursor.y.value)

		let end = Date.now()
		log('render', end - start, 'ms')
	}

	function renderCursor(x, y) {
		let cursor = editor.querySelector('.cursor')
		let cursorX = x + 'ch'
		// TODO dependency on line height, which is 16 px right now
		let cursorY = y * 16 + 'px'
		cursor.style.setProperty('--x', cursorX)
		cursor.style.setProperty('--y', cursorY)
	}

	render()

	globals.fileChangeEvents.forEach(([startLine, endLine]) => {
		// TODO use startLine and endLine
		render()
	})

	stream.combine(globals.cursor.x, globals.cursor.y).forEach(([x, y]) => {
		renderCursor(x, y)
	})

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
		let key = e.key

		if (key === 'Tab') {
			e.preventDefault()
			insert(content, '\t')
		}

		if (key === 'ArrowDown') {
			e.preventDefault()
			actions.cursorDown()
		}

		if (key === 'ArrowUp') {
			e.preventDefault()
			actions.cursorUp()
		}

		if (key === 'ArrowLeft') {
			e.preventDefault()
			actions.cursorLeft()
		}

		if (key === 'ArrowRight') {
			e.preventDefault()
			actions.cursorRight()
		}
	})

	editor.addEventListener('keypress', function(e) {
		log('Got key', e)
		if (e.key) {
			insert(content, e.key)
		}

	})

	// cmd-s to save
	editor.addEventListener('keydown', function(e) {
log('keydown', e.key)

		let key = e.key

		if ((window.navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)
			&& e.keyCode === 83
		) {
			e.preventDefault()

			if (editor === globals.editorInFocus) {
				log(`editor ${filename}: saving`)
				fileUtils.save(filename, content)
				alert(humanReadableFilename + ' saved')
			}
		}
	})
}

initClassicEditor('./editor.js', '.editor.classic')
initNewEditor('./editor.js', '.editor.new')
