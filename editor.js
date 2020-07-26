let fs = require('fs')
let path = require('path')

let log = console.log

let globals = {
	editorInFocus: null
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

		// TODO
		let cursor = document.createElement('div')
	}

	render()

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
		if (e.keyCode === 9) {
			e.preventDefault()
			// TODO implement tab
		}
	})

	// cmd-s to save
	window.addEventListener('keydown', function(e) {
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
	})

}

initClassicEditor('./editor.js', '.editor.classic')
initNewEditor('./editor.js', '.editor.new')
