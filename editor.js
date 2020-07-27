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

	cursor: {
		x: stream(0),
		y: stream(0),
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
		globals.cursor.y.value++
		render()
	},
	cursorUp: () => {
		globals.cursor.y.value--
		render()
	},
	cursorLeft: () => {
		globals.cursor.x.value--
		render()
	},
	cursorRight: () => {
		globals.cursor.x.value++
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

		let cursor = editor.querySelector('.cursor')

		let cursorX = globals.cursor.x + 'ch'
		// TODO dependency on line height, which is 16 px right now
		let cursorY = globals.cursor.y * 16 + 'px'
		cursor.style.setProperty('--x', cursorX)
		cursor.style.setProperty('--y', cursorY)

let end = Date.now()
log('render', end - start, 'ms')
	}

	render()

	stream.combine(globals.cursor.x, globals.cursor.y).forEach(([x, y]) => {
		render()
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
