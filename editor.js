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

let config = {
	fontHeight: 16,
	fontWidth: 0, // will be computed when the first character is rendered
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

// Passed to actions; contains helpers for accessing the text content
// and editor state
class Context {
	constructor(content, cursor) {
		this.content = content
		this.cursor = cursor
		this.line = this.cursor.y.value
		this.column = this.cursor.x.value
	}

	get currentLine() {
		return this.content[this.line]
	}

	get lineBeforeCursor() {
		return this.currentLine.substring(0, this.column)
	}

	get lineAfterCursor() {
		return this.currentLine.substring(this.column)
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
		let lineNumber = globals.cursor.y.value
		let columnNumber = globals.cursor.x.value

		let line = content[lineNumber]
		if (!line) {
			error('No line at cursor position')
		}

		let start = line.substring(0, columnNumber - 1)
		let end = line.substring(columnNumber)

		content[lineNumber] = start + end
		globals.cursor.x.value--

		globals.fileChangeEvents.value = [lineNumber, lineNumber]
	},

	insert: (context, character) => {
		let content = context.content

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
	},

	enter: (content) => {
		let lineNumber = globals.cursor.y.value
		let columnNumber = globals.cursor.x.value
		let line = content[lineNumber]

		if (!line) {
			error('No line at cursor position')
		}

		let start = line.substring(0, columnNumber)
		let end = line.substring(columnNumber)
		content[lineNumber] = start
		content.splice(lineNumber + 1, 0, end)

		globals.fileChangeEvents.value = [lineNumber, Infinity]
		globals.cursor.x.value = 0
		globals.cursor.y.value = lineNumber + 1
	}

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
		fs.writeFileSync(filename, file, 'utf8')
	}
}

function initNewEditor(filename, selector) {
	let content
	// TODO make filename a stream and humanReadableFilename a derived version of it
	let humanReadableFilename = path.normalize(filename)

	let editor = document.querySelector(selector)
	let textElement = editor.querySelector('.text')
	let textWrapper = editor.querySelector('.text-wrapper')

	let gotFocus = () => {
		log(`editor ${filename}: got focus`)
		document.title = humanReadableFilename
		globals.editorInFocus = editor
	}

	function open(newFilename) {
		filename = newFilename
		humanReadableFilename = path.normalize(filename)

		// Likewise, it would be a good idea to make the document.title
		// update automatically by using a stream
		textWrapper.focus()
		gotFocus()

		content = fileUtils.load(filename)
		globals.fileChangeEvents.value = [0, Infinity]
	}

	function render(lines) {
		log('Rendering, line range', lines)

		let start = Date.now()

		textElement.innerHTML = ''
		let firstCharElement

		for (let line of content) {
			let lineElement = document.createElement('div')
			lineElement.className = 'line'

			// Tab calculation
			let visibleX = 0

			for (let char of line) {
				let charElement = document.createElement('div')

				charElement.className = 'char'

				if (char === '\t') {
					let missingChars = 4 - visibleX % 4

					charElement.classList.add('tab')
					charElement.style.width = missingChars + 'ch'
					visibleX += missingChars
				} else {
					visibleX++
					firstCharElement = firstCharElement || charElement
				}

				charElement.textContent = char
				lineElement.appendChild(charElement)
			}

			textElement.appendChild(lineElement)
			if (!config.fontWidth) {
				config.fontWidth = firstCharElement.clientWidth
			}
		}

		renderCursor(globals.cursor.x.value, globals.cursor.y.value)

		let end = Date.now()
		log('render', end - start, 'ms')
	}

	open(filename)

	function renderCursor(x, y) {
		let lineAtY = content[y]

		if (lineAtY === undefined) {
			error('No line at ' + y)
			return
		}

		// Do tabs
		let visibleX = 0
		for (let i = 0; i < x; i++) {
			let c = lineAtY[i]
			if (c === '\t') {
				do {
					visibleX++
				} while (visibleX % 4 !== 0)
			} else {
				visibleX++
			}
		}

		let cursor = editor.querySelector('.cursor')
		let cursorX = visibleX + 'ch'
		// TODO dependency on line height, which is 16 px right now
		let cursorY = y * 16 + 'px'
		cursor.style.setProperty('--x', cursorX)
		cursor.style.setProperty('--y', cursorY)
	}

	globals.fileChangeEvents.forEach(render)

	stream.combine(globals.cursor.x, globals.cursor.y).forEach(([x, y]) => {
		renderCursor(x, y)
	})

	textWrapper.addEventListener('focus', gotFocus)
	textWrapper.focus()
	gotFocus()

	function action(name, ...args) {
		let context = new Context(content, globals.cursor)
		log('action', name, ...args)
		actions[name](context, ...args)
	}

	// tab inserts a tab instead of the usual
	textWrapper.addEventListener('keydown', function(e) {
		let key = e.key
log('text-wrapper keydown', key)

		if (key === 'Tab') {
			e.preventDefault()
			actions.insert(content, '\t')
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

		if (key === 'Backspace') {
			e.preventDefault()
			actions.backspace(content)
		}

		if (key === ' ') {
			e.preventDefault()
			action('insert', ' ')
//			actions.insert(content, ' ')
		}

		if (key === 'Enter') {
			e.preventDefault()
			actions.enter(content)
		}

		// cmd-s to save
		if ((window.navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)
			&& key === 's'
		) {
			log('cmd s')
			e.preventDefault()

			if (editor === globals.editorInFocus) {
				log(`editor ${filename}: saving`)
				fileUtils.save(filename, content)
				alert(humanReadableFilename + ' saved')
			}
		}

		// cmd-o to open
		if ((window.navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)
			&& key === 'o'
		) {
			log('cmd o')
			e.preventDefault()

			let prompt = editor.querySelector('.prompt')
			prompt.innerHTML = ''

			prompt.classList.remove('hidden')

			function closePrompt() {
				prompt.classList.add('hidden')
				textWrapper.focus()
			}

			let label = document.createElement('label')
			label.textContent = 'Open file:'

			let input = document.createElement('input')
			input.setAttribute('spellcheck', 'false')
			input.addEventListener('keydown', (ev) => {
				log('keydown jee', ev)
				if (ev.key === 'Enter') {
					ev.preventDefault()
					if (input.value) {
						try {
							open(input.value)
							closePrompt()
						} catch (err) {
							alert(err.message)
						}
					}
				}

				if (ev.key === 'Tab') {
					ev.preventDefault()
					if (input.value) {
						let completions = fs.readdirSync('.').filter(x => x.startsWith(input.value))
						if (completions.length) {
							input.value = completions[0]
						} else {
							log('no completions, might blink or something')
						}
					}
				}

				if (ev.key === 'Escape') {
					closePrompt()
				}
			})

			prompt.appendChild(label)
			prompt.appendChild(input)

			input.focus()
		}
	})

	textWrapper.addEventListener('keypress', function(e) {
		log('keypress', e)
		if (e.key) {
			action('insert', e.key)
//			actions.insert(content, e.key)
		}
	})

	textWrapper.addEventListener('click', function(e) {
		let rect = textElement.getBoundingClientRect()
		var x = e.clientX - rect.left
		var y = e.clientY - rect.top

		let MAGIC_Y = 0.5

		let line = Math.round(y / config.fontHeight - MAGIC_Y)

		// TODO check upper boundary too
		if (line < 0) {
			line = 0
		}

		let screenColumnAccurate = x / config.fontWidth
		let screenColumn = Math.round(x / config.fontWidth)

		let column = getActualCursorColumn(screenColumn, line, screenColumnAccurate)
		globals.cursor.x.value = column
		globals.cursor.y.value = line
	})


	// Find out which actual column is nearest to `screenColumnAccurate` (which may be
	// a non-integer) on screen, taking into account tabs
	function getActualCursorColumn(screenColumn, line, screenColumnAccurate) {
		let lineContent = content[line]
		// visible column
		let column = 0
		for (let i = 0; i < lineContent.length; i++) {
			if (lineContent[i] === '\t') {
					let missingChars = 4 - column % 4
					column += missingChars

					// User clicked between two positions separated by a tab characters;
					// Find out which one is closer to the actually clicked position
					if (column >= screenColumn) {
						let previousColumn = column - missingChars
						let actualDistanceFromPreviousColumn = screenColumnAccurate - previousColumn
						let actualDistanceToNextColumn = column - screenColumnAccurate
						if (actualDistanceFromPreviousColumn < actualDistanceToNextColumn) {
							return i
						} else {
							return i + 1
						}
					}
			} else {
				column++
			}

			if (column >= screenColumn) {
				return i + 1
			}
		}

		return lineContent.length
	}

	textWrapper.addEventListener('dblclick', function(e) {
		log('!!! dblclick', e)
	})
}

initClassicEditor('./editor.js', '.editor.classic')
initNewEditor('./editor.js', '.editor.new')

// Test saving config before reloading
//window.onbeforeunload = function() {
//	alert('before unload')
//fs.writeFileSync('test.txt', 'moi', 'utf8')
//}
