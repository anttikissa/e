let fs = require('fs')
let file = fs.readFileSync('./editor.js', 'utf8')

document.title = 'editor.js'

let editor = document.querySelector('.editor.classic')
editor.value = file

// cannot be seen
// console.log('file', file)

// does not work
// win.showDevTools()

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

		fs.writeFileSync('editor.js', editor.value, 'utf8')
		alert('editor.js saved')
	}
})

editor.focus()
