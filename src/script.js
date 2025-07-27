/*
 * Simple Keep – a lightweight note‑taking app inspired by Google Keep.
 *
 * This script handles all of the dynamic behaviour required for the app:
 *  - loading and saving notes from/to localStorage
 *  - rendering the notes grid with pinned and unpinned sections
 *  - adding new notes in either plain or checklist mode
 *  - editing, pinning, colour cycling and deleting notes
 *  - searching through notes using a simple text filter
 */

(() => {
  'use strict';

  // Global error handler (disabled in production).  Uncomment to surface
  // unexpected runtime errors during development.
  // window.addEventListener('error', (event) => {
  //   alert('Runtime error: ' + event.message + '\n' + event.filename + ':' + event.lineno + ':' + event.colno);
  // });

  // Constants
  const STORAGE_KEY = 'simpleKeepNotes';
  // A palette of ten pleasant pastel shades reminiscent of Google Keep
  const COLORS = [
    '#FFFFFF', // classic white
    '#FFF9C4', // lemon
    '#FFE0B2', // peach
    '#FFCDD2', // rose
    '#D7CCC8', // mocha
    '#C8E6C9', // mint
    '#BBDEFB', // sky
    '#D1C4E9', // lavender
    '#F8BBD0', // pink
    '#DCEDC8'  // lime
  ];

  // Application state
  let notes = [];
  let currentColor = COLORS[0];
  let isChecklistMode = false;
  let editNoteId = null;

  // DOM references – these variables will be assigned once the DOM has loaded.
  let searchInput;
  let noteTitleInput;
  let noteContentInput;
  let noteInputSection;
  let addNoteBtn;
  let toggleChecklistBtn;
  let colorOptionsContainer;
  let checklistContainer;
  let pinnedSection;
  let pinnedNotesDiv;
  let othersSection;
  let notesContainer;

  // Modal elements (assigned after DOM load)
  let editModal;
  let modalBackdrop;
  let closeModalBtn;
  let editTitleInput;
  let editContentInput;
  let editChecklistContainer;
  let deleteNoteBtn;
  let saveNoteBtn;
  let exportNotesBtn;
  let importNotesBtn;
  let importFileInput;

  /**
   * Load notes from localStorage.  If nothing is saved yet, use an
   * empty array.
   */
  function loadNotes() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      notes = Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('Failed to parse notes from storage:', err);
      notes = [];
    }
  }

  /**
   * Persist the current notes array into localStorage.
   */
  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  /**
   * Initialise the colour palette for note creation.  Each button sets
   * the currentColour variable and updates the input section border.
   */
  function initColourButtons() {
    COLORS.forEach((col) => {
      const btn = document.createElement('button');
      btn.classList.add('color-btn');
      btn.style.backgroundColor = col;
      btn.dataset.color = col;
      btn.title = `Set note colour to ${col}`;
      btn.addEventListener('click', () => {
        currentColor = col;
        // visually indicate selected colour on the input area
        noteInputSection.style.borderColor = col;
        // highlight chosen colour button by adding an outline
        document.querySelectorAll('.color-btn').forEach((b) => {
          b.style.outline = '';
        });
        btn.style.outline = '2px solid #666';
      });
      colorOptionsContainer.appendChild(btn);
    });
    // initialise with first colour selected
    noteInputSection.style.borderColor = COLORS[0];
    // choose the first actual button element, ignoring whitespace/comment nodes
    const firstBtn = colorOptionsContainer.querySelector('.color-btn');
    if (firstBtn) {
      firstBtn.style.outline = '2px solid #666';
    }
  }

  /**
   * Render all notes into the appropriate sections.  Applies the
   * search filter if present and keeps pinned notes separate.
   */
  function renderNotes() {
    // get search query trimmed to lower case
    const query = searchInput.value.trim().toLowerCase();
    // clear current contents
    pinnedNotesDiv.innerHTML = '';
    notesContainer.innerHTML = '';
    // partition into pinned and others
    const pinned = [];
    const others = [];
    notes.forEach((note) => {
      // skip notes that don't match search query
      if (query && !noteMatchesQuery(note, query)) return;
      if (note.pinned) pinned.push(note);
      else others.push(note);
    });
    // toggle pinned section visibility
    pinnedSection.hidden = pinned.length === 0;
    // render pinned notes first
    pinned.forEach((note) => createNoteCard(note, pinnedNotesDiv));
    others.forEach((note) => createNoteCard(note, notesContainer));
  }

  /**
   * Determine whether a note matches a query string.  Searches the
   * title, content and checklist items.
   * @param {Object} note Note object
   * @param {string} query Lowercase search query
   */
  function noteMatchesQuery(note, query) {
    if (!query) return true;
    const inTitle = note.title && note.title.toLowerCase().includes(query);
    if (inTitle) return true;
    if (note.checklist) {
      return note.items.some((item) => item.text.toLowerCase().includes(query));
    }
    return note.content && note.content.toLowerCase().includes(query);
  }

  /**
   * Create a note card DOM element and append it to a container.
   * @param {Object} note Note data
   * @param {HTMLElement} container Container to append into
   */
  function createNoteCard(note, container) {
    const card = document.createElement('div');
    card.classList.add('note-card');
    card.style.backgroundColor = note.color || '#fff';
    card.dataset.id = note.id;
    card.dataset.pinned = note.pinned;

    // Title
    if (note.title) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'note-title-display';
      titleDiv.textContent = note.title;
      card.appendChild(titleDiv);
    }
    // Content or checklist
    if (note.checklist) {
      const list = document.createElement('ul');
      list.className = 'note-list';
      note.items.forEach((item) => {
        const li = document.createElement('li');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.checked;
        // disable interaction; checkboxes on note display are not editable
        checkbox.disabled = true;
        const span = document.createElement('span');
        span.textContent = item.text;
        if (item.checked) {
          span.style.textDecoration = 'line-through';
        }
        li.appendChild(checkbox);
        li.appendChild(span);
        list.appendChild(li);
      });
      card.appendChild(list);
    } else {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content-display';
      contentDiv.textContent = note.content;
      card.appendChild(contentDiv);
    }
    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'note-actions';
    // Pin/unpin button
    const pinBtn = document.createElement('button');
    pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
    pinBtn.textContent = note.pinned ? '📌' : '📍';
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      note.pinned = !note.pinned;
      saveNotes();
      renderNotes();
    });
    actions.appendChild(pinBtn);
    // Colour cycle button
    const colourBtn = document.createElement('button');
    colourBtn.title = 'Change colour';
    colourBtn.textContent = '🎨';
    colourBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // cycle to the next colour in the palette
      const idx = COLORS.indexOf(note.color || COLORS[0]);
      const nextCol = COLORS[(idx + 1) % COLORS.length];
      note.color = nextCol;
      saveNotes();
      renderNotes();
    });
    actions.appendChild(colourBtn);
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.title = 'Edit note';
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(note.id);
    });
    actions.appendChild(editBtn);
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.title = 'Delete note';
    deleteBtn.textContent = '🗑';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this note?')) {
        deleteNoteById(note.id);
      }
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    // Clicking anywhere on card except buttons opens edit
    card.addEventListener('click', () => {
      openEditModal(note.id);
    });
    container.appendChild(card);
  }

  /**
   * Toggle checklist mode in the creation area.  When activated, the
   * textarea is hidden and checklist items can be added.  When
   * deactivated, items are discarded and any text from the first
   * checklist item is moved into the content textarea.
   */
  function toggleChecklist() {
    isChecklistMode = !isChecklistMode;
    toggleChecklistBtn.classList.toggle('active', isChecklistMode);
    if (isChecklistMode) {
      noteContentInput.style.display = 'none';
      checklistContainer.style.display = 'block';
      // if there is text in the note content box, convert it into a
      // checklist item
      const content = noteContentInput.value.trim();
      if (content) {
        addChecklistItem(content);
        noteContentInput.value = '';
      } else if (checklistContainer.children.length === 0) {
        addChecklistItem('');
      }
    } else {
      // move the first checklist item back into the note content if there
      // is only one and no content yet
      if (checklistContainer.children.length === 1 && !noteContentInput.value) {
        const li = checklistContainer.firstElementChild;
        const input = li.querySelector('input[type="text"]');
        noteContentInput.value = input.value;
      }
      // clear checklist items
      checklistContainer.innerHTML = '';
      noteContentInput.style.display = 'block';
      checklistContainer.style.display = 'none';
    }
  }

  /**
   * Add a new list item to the checklist container.  Each item
   * comprises a checkbox (for future expansion), a text input and a
   * delete button.
   * @param {string} text Initial text for the item
   * @param {boolean} checked Initial checked state
   */
  function addChecklistItem(text = '', checked = false) {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    // when user checks/unchecks, just update attribute
    checkbox.addEventListener('change', () => {
      // nothing needed here; value will be collected when saving
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = text;
    input.placeholder = 'List item';
    // pressing Enter adds a new item
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addChecklistItem('');
        setTimeout(() => {
          // focus the newly added item
          const last = checklistContainer.lastElementChild;
          if (last) last.querySelector('input[type="text"]').focus();
        }, 0);
      }
    });
    const removeBtn = document.createElement('button');
    removeBtn.title = 'Remove item';
    removeBtn.textContent = '✕';
    removeBtn.className = 'icon-btn';
    removeBtn.addEventListener('click', () => {
      li.remove();
    });
    li.appendChild(checkbox);
    li.appendChild(input);
    li.appendChild(removeBtn);
    checklistContainer.appendChild(li);
  }

  /**
   * Collect data from the checklist container into an array of
   * {text, checked} objects.  Empty items are ignored.
   */
  function collectChecklistItems(container) {
    const items = [];
    container.querySelectorAll('li').forEach((li) => {
      const textInput = li.querySelector('input[type="text"]');
      const check = li.querySelector('input[type="checkbox"]');
      const text = textInput.value.trim();
      if (text) {
        items.push({ text, checked: check.checked });
      }
    });
    return items;
  }

  /**
   * Create a new note based on the input fields and add it to the
   * notes array.  Returns true if the note was added.
   */
  function addNote() {
    // create a note based on inputs; do not proceed if both title and content are empty
    const title = noteTitleInput.value.trim();
    if (!isChecklistMode) {
      const content = noteContentInput.value.trim();
      if (!title && !content) return false;
      const newNote = {
        id: Date.now().toString(),
        title,
        content,
        checklist: false,
        items: [],
        color: currentColor,
        pinned: false
      };
      notes.unshift(newNote);
    } else {
      const items = collectChecklistItems(checklistContainer);
      if (!title && items.length === 0) return false;
      const newNote = {
        id: Date.now().toString(),
        title,
        content: '',
        checklist: true,
        items,
        color: currentColor,
        pinned: false
      };
      notes.unshift(newNote);
    }
    // reset inputs
    noteTitleInput.value = '';
    noteContentInput.value = '';
    checklistContainer.innerHTML = '';
    if (isChecklistMode) {
      // hide checklist after save to default back to note
      toggleChecklist();
    }
    saveNotes();
    renderNotes();
    return true;
  }

  /**
   * Open the edit modal for a given note id.  Populate fields and set
   * the editNoteId so we know which note to update on save.
   * @param {string} noteId ID of the note to edit
   */
  function openEditModal(noteId) {
    editNoteId = noteId;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    // populate modal fields
    editTitleInput.value = note.title || '';
    editContentInput.value = '';
    editChecklistContainer.innerHTML = '';
    if (note.checklist) {
      // hide text area and show checklist
      editContentInput.style.display = 'none';
      editChecklistContainer.style.display = 'block';
      note.items.forEach((it) => {
        const li = document.createElement('li');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!it.checked;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = it.text;
        // allow adding new items on Enter
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addEditChecklistItem('', false);
            setTimeout(() => {
              const last = editChecklistContainer.lastElementChild;
              if (last) last.querySelector('input[type="text"]').focus();
            }, 0);
          }
        });
        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-btn';
        removeBtn.textContent = '✕';
        removeBtn.title = 'Remove item';
        removeBtn.addEventListener('click', () => {
          li.remove();
        });
        li.appendChild(checkbox);
        li.appendChild(input);
        li.appendChild(removeBtn);
        editChecklistContainer.appendChild(li);
      });
      // ensure there is at least one empty item to add new
      addEditChecklistItem('');
    } else {
      // normal note
      editContentInput.style.display = 'block';
      editChecklistContainer.style.display = 'none';
      editContentInput.value = note.content;
    }
    // Show modal
    editModal.classList.add('show');
    editModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * Add a checklist item to the edit modal container.  Similar to the
   * creation area but bound to the edit container.
   * @param {string} text Item text
   * @param {boolean} checked Checked state
   */
  function addEditChecklistItem(text = '', checked = false) {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = text;
    input.placeholder = 'List item';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addEditChecklistItem('');
        setTimeout(() => {
          const last = editChecklistContainer.lastElementChild;
          if (last) last.querySelector('input[type="text"]').focus();
        }, 0);
      }
    });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'icon-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove item';
    removeBtn.addEventListener('click', () => {
      li.remove();
    });
    li.appendChild(checkbox);
    li.appendChild(input);
    li.appendChild(removeBtn);
    editChecklistContainer.appendChild(li);
  }

  /**
   * Close the edit modal and reset state.
   */
  function closeEditModal() {
    editModal.classList.remove('show');
    editModal.setAttribute('aria-hidden', 'true');
    editNoteId = null;
    editChecklistContainer.innerHTML = '';
    editContentInput.value = '';
    editTitleInput.value = '';
  }

  /**
   * Delete a note by ID and refresh the display.
   * @param {string} id Note identifier
   */
  function deleteNoteById(id) {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    renderNotes();
    // if editing, close modal
    if (editNoteId === id) {
      closeEditModal();
    }
  }

  /**
   * Save changes from the edit modal back into the notes array.  If
   * the note no longer exists (deleted), nothing happens.
   */
  function saveEditedNote() {
    if (!editNoteId) return;
    const note = notes.find((n) => n.id === editNoteId);
    if (!note) return;
    note.title = editTitleInput.value.trim();
    if (note.checklist) {
      // gather items from edit checklist
      const items = [];
      editChecklistContainer.querySelectorAll('li').forEach((li) => {
        const textInput = li.querySelector('input[type="text"]');
        const check = li.querySelector('input[type="checkbox"]');
        const text = textInput.value.trim();
        if (text) {
          items.push({ text, checked: check.checked });
        }
      });
      note.items = items;
    } else {
      note.content = editContentInput.value.trim();
    }
    saveNotes();
    renderNotes();
    closeEditModal();
  }

  /**
   * Trigger a download of the current notes as a JSON file.  Users can then
   * upload this file to any cloud storage provider (Google Drive, OneDrive,
   * Dropbox, etc.) as a personal backup.
   */
  function exportNotes() {
    const data = JSON.stringify(notes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    link.download = `simple-keep-notes-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Handle importing notes from a JSON file.  Reads the selected file,
   * parses it and replaces the current notes array.  This will overwrite
   * any existing notes; users should be prompted to confirm before doing this.
   * @param {Event} event Change event from file input
   */
  function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) {
          alert('Invalid backup file: expected an array of notes.');
          return;
        }
        if (!confirm('Importing will replace your current notes. Continue?')) {
          return;
        }
        notes = imported;
        saveNotes();
        renderNotes();
      } catch (err) {
        alert('Failed to import notes: ' + err.message);
      }
    };
    reader.readAsText(file);
    // reset the input so the same file can be selected again if needed
    event.target.value = '';
  }

  /**
   * Set up event listeners for the UI.
   */
  function initEventListeners() {
    // Event listeners initialised
    // Search input triggers filtering on input
    searchInput.addEventListener('input', () => {
      renderNotes();
    });
    // Add note button
    addNoteBtn.addEventListener('click', () => {
      addNote();
    });
    // Toggle checklist button
    toggleChecklistBtn.addEventListener('click', () => {
      toggleChecklist();
    });
    // Handle Enter key in title or content fields for quick add
    noteContentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // prevent newline addition; treat as add note
        e.preventDefault();
        addNote();
      }
    });
    noteTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNote();
      }
    });
    // Modal close by clicking on backdrop or X button
    modalBackdrop.addEventListener('click', () => {
      closeEditModal();
    });
    closeModalBtn.addEventListener('click', () => {
      closeEditModal();
    });
    // Delete note via modal
    deleteNoteBtn.addEventListener('click', () => {
      if (editNoteId && confirm('Delete this note?')) {
        deleteNoteById(editNoteId);
      }
    });
    // Save note via modal
    saveNoteBtn.addEventListener('click', () => {
      saveEditedNote();
    });

    // Export and import buttons
    if (exportNotesBtn) {
      exportNotesBtn.addEventListener('click', () => {
        exportNotes();
      });
    }
    if (importNotesBtn && importFileInput) {
      importNotesBtn.addEventListener('click', () => {
        // trigger file selection dialog
        importFileInput.click();
      });
      importFileInput.addEventListener('change', handleImport);
    }
  }

  /**
   * Entry point: initialise the app.  Load notes, set up event listeners
   * and render the initial view.
   */
  function init() {
    try {
      // init executed (debug message removed)
      // assign DOM references now that the DOM is fully loaded
      searchInput = document.getElementById('searchInput');
      noteTitleInput = document.getElementById('noteTitle');
      noteContentInput = document.getElementById('noteContent');
      noteInputSection = document.getElementById('noteInput');
      addNoteBtn = document.getElementById('addNoteBtn');
      toggleChecklistBtn = document.getElementById('toggleChecklistBtn');
      colorOptionsContainer = document.querySelector('.color-options');
      checklistContainer = document.getElementById('checklistContainer');
      pinnedSection = document.getElementById('pinnedSection');
      pinnedNotesDiv = document.getElementById('pinnedNotes');
      othersSection = document.getElementById('othersSection');
      notesContainer = document.getElementById('notesContainer');
      // modal references
      editModal = document.getElementById('editModal');
      modalBackdrop = document.getElementById('modalBackdrop');
      closeModalBtn = document.getElementById('closeModalBtn');
      editTitleInput = document.getElementById('editTitle');
      editContentInput = document.getElementById('editContent');
      editChecklistContainer = document.getElementById('editChecklistContainer');
      deleteNoteBtn = document.getElementById('deleteNoteBtn');
      saveNoteBtn = document.getElementById('saveNoteBtn');
      // export/import controls
      exportNotesBtn = document.getElementById('exportNotesBtn');
      importNotesBtn = document.getElementById('importNotesBtn');
      importFileInput = document.getElementById('importFileInput');
      // now initialise colour buttons and event listeners
      initColourButtons();
      loadNotes();
      initEventListeners();
      renderNotes();
      // hide checklist containers initially
      checklistContainer.style.display = 'none';
      editChecklistContainer.style.display = 'none';
    } catch (e) {
      // Log initialisation errors to the console rather than interrupting the user.
      console.error('Initialisation error:', e);
    }
  }

  // Kick off the app.  Because the script is placed at the end of the
  // document body, the DOM is already available and we can initialise
  // immediately.  If additional safety is desired for earlier loading
  // scenarios, wrap this in a DOMContentLoaded check.
  init();
})();