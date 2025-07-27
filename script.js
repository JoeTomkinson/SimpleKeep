/*
     * Simple Keep – a lightweight note‑taking app inspired by Google Keep.
     *
     * This script handles all of the dynamic behaviour required for the app:
     *  - loading and saving notes from/to localStorage
     *  - rendering the notes grid with pinned and unpinned sections
     *  - adding new notes in either plain or checklist mode
     *  - editing, pinning, colour cycling and deleting notes
     *  - searching through notes using a simple text filter
     *  - drag and drop reordering of notes
     *  - updated icons using Google Material Icons
     */

    (() => {
      'use strict';

      // Global error handler (disabled in production).  Uncomment to surface
      // unexpected runtime errors during development.
      // window.addEventListener('error', (event) => {
      //   alert('Runtime error: ' + event.message + '\n' + event.filename + ':'
      // + event.lineno + ':' + event.colno);
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

      // Drag state for reordering
      let draggedNoteId = null;

      // Character limit for truncating long note descriptions.  If a note's
      // content exceeds this length, the card will display a shortened
      // version followed by a Read More link that opens the full note in
      // a modal.  Adjust this value to taste.
      const DESCRIPTION_CHAR_LIMIT = 160;

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

      // Theme toggle button
      let themeToggleBtn;

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

      // View modal elements for "Read More" functionality (assigned after DOM load)
      let viewModal;
      let viewModalBackdrop;
      let closeViewModalBtn;
      let viewTitleEl;
      let viewContentEl;
      let viewNoteActions;

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
          return note.items.some((item) =>
            item.text.toLowerCase().includes(query)
          );
        }
        return note.content && note.content.toLowerCase().includes(query);
      }

      /**
       * Reorder notes by swapping the positions of two notes.  When a note
       * is dragged onto another note, their positions in the `notes`
       * array will be exchanged.  Swapping maintains the relative order
       * of the remaining notes and provides a more intuitive drag
       * interaction than simply inserting before the target.  Swaps are
       * only permitted within the same pinned/unpinned group.
       *
       * @param {string} draggedId ID of the note being dragged
       * @param {string} targetId  ID of the note being dropped onto
       */
      function reorderNotes(draggedId, targetId) {
        // do nothing if the same card is dragged onto itself
        if (draggedId === targetId) return;
        const draggedIndex = notes.findIndex((n) => n.id === draggedId);
        const targetIndex = notes.findIndex((n) => n.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        // enforce swapping only within the same pinned status
        if (notes[draggedIndex].pinned !== notes[targetIndex].pinned) return;
        // Swap the two note objects.  This simply exchanges the
        // positions within the array; note metadata remains unchanged.
        const tmp = notes[draggedIndex];
        notes[draggedIndex] = notes[targetIndex];
        notes[targetIndex] = tmp;
        saveNotes();
        renderNotes();
      }

      /**
       * Reorder note to end of its group when dropping onto container.
       * @param {string} draggedId ID of the note being dragged
       * @param {boolean} pinnedFlag true if the target container is pinned section
       */
      function reorderToEnd(draggedId, pinnedFlag) {
        const draggedIndex = notes.findIndex((n) => n.id === draggedId);
        if (draggedIndex === -1) return;
        const draggedNote = notes[draggedIndex];
        if (draggedNote.pinned !== pinnedFlag) return;
        // remove note
        notes.splice(draggedIndex, 1);
        // find last index of group
        let insertIndex = -1;
        for (let i = 0; i < notes.length; i++) {
          if (notes[i].pinned === pinnedFlag) {
            insertIndex = i;
          }
        }
        notes.splice(insertIndex + 1, 0, draggedNote);
        saveNotes();
        renderNotes();
      }

      /**
       * Create a note card DOM element and append it to a container.
       * @param {Object} note Note data
       * @param {HTMLElement} container Container to append into
       */
      function createNoteCard(note, container) {
        const card = document.createElement('div');
        card.classList.add('note-card');
        // Apply entry animation using animate.css.  Newly created cards fade in from below.
        card.classList.add('animate__animated', 'animate__fadeInUp');
        // Determine note background and accent colour.  In dark mode
        // individual note colours can be overwhelming against a dark
        // canvas.  In that case fall back to the shared card background
        // and use the note colour as a left border accent instead.
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
          card.style.backgroundColor = '';
          if (note.color) {
            card.style.borderLeft = `6px solid ${note.color}`;
          }
        } else {
          card.style.backgroundColor = note.color || '#fff';
          card.style.borderLeft = '';
        }
        card.dataset.id = note.id;
        card.dataset.pinned = note.pinned;

        // Add a drag handle at the top left to indicate drag capability.  The
        // handle is purely decorative; dragging anywhere on the card will
        // still initiate a reorder.  Users can grab this handle for
        // reassurance.  Bootstrap Icons provide the grip symbol.
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
        card.appendChild(dragHandle);
        // make card draggable for reordering
        card.draggable = true;
        // record dragged note id on dragstart
        card.addEventListener('dragstart', (e) => {
          draggedNoteId = note.id;
          e.dataTransfer.effectAllowed = 'move';
          // Add dragging class for visual feedback
          card.classList.add('dragging');
        });
        // Remove dragging class on drag end
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });
        // allow dropping onto other cards.  Prevent the event from bubbling
        // to parent containers so that dropping directly on a card swaps
        // positions rather than sending it to the end of the list.
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          e.stopPropagation();
        });
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetId = note.id;
          if (draggedNoteId && draggedNoteId !== targetId) {
            reorderNotes(draggedNoteId, targetId);
          }
        });

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
          // For long descriptions, truncate and append a Read More link.
          if (note.content && note.content.length > DESCRIPTION_CHAR_LIMIT) {
            const truncated = note.content.slice(0, DESCRIPTION_CHAR_LIMIT).trim() + '… ';
            contentDiv.textContent = truncated;
            const readMoreSpan = document.createElement('span');
            readMoreSpan.className = 'read-more';
            readMoreSpan.textContent = '[Read More]';
            readMoreSpan.addEventListener('click', (e) => {
              e.stopPropagation();
              openViewModal(note.id);
            });
            contentDiv.appendChild(readMoreSpan);
          } else {
            contentDiv.textContent = note.content;
          }
          card.appendChild(contentDiv);
        }
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'note-actions';
        // Pin/unpin button
        const pinBtn = document.createElement('button');
        pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
        // use Bootstrap icons for pin/unpin
        pinBtn.innerHTML = note.pinned
          ? '<i class="bi bi-pin-angle-fill"></i>'
          : '<i class="bi bi-pin-angle"></i>';
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
        colourBtn.innerHTML = '<i class="bi bi-palette"></i>';
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
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditModal(note.id);
        });
        actions.appendChild(editBtn);
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.title = 'Delete note';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this note?')) {
            deleteNoteById(note.id);
          }
        });
        actions.appendChild(deleteBtn);

        card.appendChild(actions);
        // Do not open the edit modal when clicking on the card itself.  The
        // edit button provides the only entry point for editing.
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
          if (
            checklistContainer.children.length === 1 &&
            !noteContentInput.value
          ) {
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
       * Open the view modal to display the full content of a note.  This
       * function is invoked when a user clicks the Read More link on a
       * truncated note.  It populates the modal with the note's title,
       * content or checklist and builds a fresh set of action buttons
       * (pin/unpin, colour cycle, edit and delete) that operate on the
       * underlying note.  The modal can be dismissed by the user via
       * closeViewModal().
       * @param {string} noteId Identifier of the note to view
       */
      function openViewModal(noteId) {
        const note = notes.find((n) => n.id === noteId);
        if (!note) return;
        // populate title
        viewTitleEl.textContent = note.title || '';
        // populate content or checklist
        viewContentEl.innerHTML = '';
        if (note.checklist) {
          const ul = document.createElement('ul');
          ul.className = 'note-list';
          note.items.forEach((item) => {
            const li = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!item.checked;
            checkbox.disabled = true;
            const span = document.createElement('span');
            span.textContent = item.text;
            if (item.checked) span.style.textDecoration = 'line-through';
            li.appendChild(checkbox);
            li.appendChild(span);
            ul.appendChild(li);
          });
          viewContentEl.appendChild(ul);
        } else {
          // plain text note; preserve whitespace
          const p = document.createElement('p');
          p.textContent = note.content;
          viewContentEl.appendChild(p);
        }
        // build action buttons
        viewNoteActions.innerHTML = '';
        // Pin/unpin
        const pinBtn = document.createElement('button');
        pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
        pinBtn.innerHTML = note.pinned
          ? '<i class="bi bi-pin-angle-fill"></i>'
          : '<i class="bi bi-pin-angle"></i>';
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          note.pinned = !note.pinned;
          saveNotes();
          renderNotes();
          // refresh the modal to update the icon
          openViewModal(noteId);
        });
        viewNoteActions.appendChild(pinBtn);
        // Colour cycle
        const colourBtn = document.createElement('button');
        colourBtn.title = 'Change colour';
        colourBtn.innerHTML = '<i class="bi bi-palette"></i>';
        colourBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = COLORS.indexOf(note.color || COLORS[0]);
          const nextCol = COLORS[(idx + 1) % COLORS.length];
          note.color = nextCol;
          saveNotes();
          renderNotes();
          openViewModal(noteId);
        });
        viewNoteActions.appendChild(colourBtn);
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.title = 'Edit note';
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeViewModal();
          openEditModal(noteId);
        });
        viewNoteActions.appendChild(editBtn);
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.title = 'Delete note';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this note?')) {
            deleteNoteById(noteId);
            closeViewModal();
          }
        });
        viewNoteActions.appendChild(deleteBtn);
        // show the modal via Micromodal
        if (typeof MicroModal !== 'undefined') {
          MicroModal.show('noteViewModal');
        } else {
          // Fallback: if MicroModal is unavailable, toggle class for compatibility
          if (viewModal) {
            viewModal.classList.add('show');
            viewModal.setAttribute('aria-hidden', 'false');
          }
        }
      }

      /**
       * Close the view modal and clear its contents.
       */
      function closeViewModal() {
        // If Micromodal is available, close the modal via the library.
        if (typeof MicroModal !== 'undefined') {
          try {
            MicroModal.close('noteViewModal');
          } catch (err) {
            // ignore if closing fails (e.g. modal not open)
          }
        } else {
          // Fallback: manually hide the modal
          if (!viewModal) return;
          viewModal.classList.remove('show');
          viewModal.setAttribute('aria-hidden', 'true');
        }
        // clear title and content
        if (viewTitleEl) viewTitleEl.textContent = '';
        if (viewContentEl) viewContentEl.innerHTML = '';
        if (viewNoteActions) viewNoteActions.innerHTML = '';
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

        // View modal close handlers for Read More.  Dismiss the view modal
        // when the backdrop or close button are clicked.
        if (viewModalBackdrop && closeViewModalBtn) {
          viewModalBackdrop.addEventListener('click', () => {
            closeViewModal();
          });
          closeViewModalBtn.addEventListener('click', () => {
            closeViewModal();
          });
        }
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

        // Drag-and-drop listeners on containers for ordering
        pinnedNotesDiv.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        pinnedNotesDiv.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedNoteId) {
            reorderToEnd(draggedNoteId, true);
          }
        });
        notesContainer.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        notesContainer.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedNoteId) {
            reorderToEnd(draggedNoteId, false);
          }
        });
      }

      /**
       * Initialise the dark/light theme toggle.  Reads the user's saved
       * preference from localStorage and applies the appropriate mode.  The
       * button icon is updated to reflect the alternate state (sun for
       * light mode, moon for dark mode).  Clicking the toggle saves the
       * new preference and updates the UI immediately.
       */
      function initThemeToggle() {
        if (!themeToggleBtn) return;
        // helper to apply a theme and update the toggle icon
        function applyTheme(theme) {
          const isDark = theme === 'dark';
          document.body.classList.toggle('dark-mode', isDark);
          // set icon: sun when dark, moon when light
          themeToggleBtn.innerHTML = isDark
            ? '<i class="bi bi-sun"></i>'
            : '<i class="bi bi-moon"></i>';
        }
        // read stored preference
        const stored = localStorage.getItem('simpleKeepTheme');
        const initialTheme = stored === 'dark' ? 'dark' : 'light';
        applyTheme(initialTheme);
        // listen for clicks to toggle theme
        themeToggleBtn.addEventListener('click', () => {
          const currentDark = document.body.classList.contains('dark-mode');
          const newTheme = currentDark ? 'light' : 'dark';
          applyTheme(newTheme);
          localStorage.setItem('simpleKeepTheme', newTheme);
          // re-render notes so their backgrounds and accents update with the new theme
          renderNotes();
        });
      }

      /**
       * Entry point: initialise the app.  Load notes, set up event listeners
       * and render the initial view.
       */
      function init() {
        try {
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

          // view modal references for read more (Micromodal)
          viewModal = document.getElementById('noteViewModal');
          // overlay and close button are managed by Micromodal; these references
          // remain only for backward compatibility
          viewModalBackdrop = document.querySelector('#noteViewModal .modal__overlay');
          closeViewModalBtn = document.getElementById('closeNoteViewBtn');
          viewTitleEl = document.getElementById('noteViewTitle');
          viewContentEl = document.getElementById('noteViewBody');
          viewNoteActions = document.getElementById('noteViewActions');
          // theme toggle
          themeToggleBtn = document.getElementById('themeToggleBtn');
          // now initialise colour buttons and event listeners
          initColourButtons();
          loadNotes();
          initEventListeners();
          // initialise theme toggle (light/dark mode)
          initThemeToggle();
          // initialise Micromodal to handle the view modal.  Disable body
          // scrolling when open and enable open/close animations.  If
          // Micromodal is unavailable, this call is ignored.
          if (typeof MicroModal !== 'undefined') {
            MicroModal.init({
              disableScroll: true,
              awaitOpenAnimation: true,
              awaitCloseAnimation: false,
            });
          }
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