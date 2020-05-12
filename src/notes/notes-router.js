const path = require("path");
const express = require("express");
const xss = require("xss");
const notesService = require("./notes-service");

const notesRouter = express.Router();
const jsonParser = express.json();

const serializeNote = note => ({
	id: note.id,
    note_name: xss(note.note_name),
    content: xss(note.content),
    modified: note.modified,
    folder_id: note.folder_id
});

notesRouter
	.route("/")
	.get((req, res, next) => {
		const knexInstance = req.app.get("db");
		notesService.getAllNotes(knexInstance)
			.then(notes => {
				res.json(notes.map(serializeNote));
			})
			.catch(next);
	})
	.post(jsonParser, (req, res, next) => {
		const { note_name, content, folder_id } = req.body;
		const newNote = {
            note_name,
            content,
            folder_id
		};

		for (const [key, value] of Object.entries(newNote))
			if (value == null)
				return res.status(400).json({
					error: {
						message: `Missing '${key}' in request body`
					}
				});

		notesService.insertNote(req.app.get("db"), newNote)
			.then(note => {
				res.status(201)
					.location(
						path.posix.join(req.originalUrl + `/${note.id}`)
					)
					.json(serializeNote(note));
			})
			.catch(next);
	});

notesRouter
	.route("/:note_id")
	.all((req, res, next) => {
		notesService.getById(req.app.get("db"), req.params.note_id)
			.then(note => {
				if (!note) {
					return res.status(404).json({
						error: { message: `note doesn't exist` }
					});
				}
				res.note = note;
				next();
			})
			.catch(next);
	})
	.get((req, res, next) => {
		res.json(serializeNote(res.note));
	})
	.delete((req, res, next) => {
		notesService.deleteNote(req.app.get("db"), req.params.note_id)
			.then(numRowsAffected => {
				res.status(204).end();
			})
			.catch(next);
	})
	.patch(jsonParser, (req, res, next) => {
		const { note_name, content } = req.body;
		const noteToUpdate = { note_name, content };

		const numberOfValues = Object.values(noteToUpdate).filter(Boolean)
			.length;
		if (numberOfValues === 0) {
			return res.status(400).json({
				error: {
					message: `Request body must contain either 'note name' or 'content'.`
				}
			});
		}
		notesService.updateNote(
			req.app.get("db"),
			req.params.note_id,
			noteToUpdate
		)
			.then(numRowsAffected => {
				res.status(204).end();
			})
			.catch(next);
	});

module.exports = notesRouter;
