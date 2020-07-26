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
				log(`editor ${filename}: saving`)
				fs.writeFileSync(filename, editor.value, 'utf8')
				alert(humanReadableFilename + ' saved')
			}
		}
	})
}

initClassicEditor('./editor.js', '.editor.classic')
initClassicEditor('./index.html', '.editor.new')
