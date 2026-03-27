// Regras de negócio da aplicação
const BusinessRules = {
    WIP_LIMIT: 3,        // Máximo de cards na coluna "Fazendo"
    MAX_CARDS: 20,       // Máximo de cards no quadro
    MIN_TITLE_LENGTH: 3, // Mínimo de caracteres no título
    COLUMN_ORDER: ['todo', 'doing', 'done'],

    // RN01 - Limite de cards em progresso (WIP)
    canMoveToColumn(newStatus) {
        if (newStatus !== 'doing') return { ok: true };
        const count = StateManager.getCardsByStatus('doing').length;
        if (count >= this.WIP_LIMIT)
            return { ok: false, message: `Limite atingido! A coluna "Fazendo" permite no máximo ${this.WIP_LIMIT} cards. Conclua um card antes de adicionar outro.` };
        return { ok: true };
    },

    // RN02 - Título deve ter mínimo de caracteres
    validateTitle(text) {
        if (text.length < this.MIN_TITLE_LENGTH)
            return { ok: false, message: `O título deve ter no mínimo ${this.MIN_TITLE_LENGTH} caracteres.` };
        return { ok: true };
    },

    // RN03 - Card não pode voltar para coluna anterior
    canMoveBackward(currentStatus, newStatus) {
        const currentIndex = this.COLUMN_ORDER.indexOf(currentStatus);
        const newIndex = this.COLUMN_ORDER.indexOf(newStatus);
        if (newIndex < currentIndex)
            return { ok: false, message: 'Um card não pode voltar para uma coluna anterior.' };
        return { ok: true };
    },

    // RN05 - Não permite título duplicado na mesma coluna
    hasDuplicateTitle(text, status, excludeId = null) {
        const duplicate = StateManager.getCardsByStatus(status)
            .find(c => c.text.toLowerCase() === text.toLowerCase() && c.id !== excludeId);
        if (duplicate)
            return { ok: false, message: 'Já existe um card com este título nesta coluna.' };
        return { ok: true };
    },

    // RN06 - Limite total de cards no quadro
    canAddCard() {
        if (StateManager.state.cards.length >= this.MAX_CARDS)
            return { ok: false, message: `Limite de ${this.MAX_CARDS} cards atingido! Exclua um card para adicionar outro.` };
        return { ok: true };
    }
};

// Exibe notificações visuais na tela
const Notify = {
    show(message) {
        const existing = document.querySelector('.kanban-notify');
        if (existing) existing.remove();

        const notify = document.createElement('div');
        notify.className = 'kanban-notify';
        notify.textContent = message;
        document.body.appendChild(notify);

        notify.offsetHeight;
        notify.classList.add('kanban-notify--visible');

        setTimeout(() => {
            notify.classList.remove('kanban-notify--visible');
            setTimeout(() => notify.remove(), 300);
        }, 3000);
    }
};

// Gerencia o estado da aplicação e persistência no LocalStorage
const StateManager = {
    STORAGE_KEY: 'kanban_board_state',
    state: { cards: [], nextId: 1 },

    load() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) this.state = JSON.parse(saved);
        } catch (e) {}
        return this.state;
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {}
    },

    addCard(text, status = 'todo') {
        const card = { id: this.state.nextId++, text, status, createdAt: new Date().toISOString() };
        this.state.cards.push(card);
        this.save();
        return card;
    },

    updateCard(id, newText) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) { card.text = newText; card.updatedAt = new Date().toISOString(); this.save(); }
        return card;
    },

    moveCard(id, newStatus) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) { card.status = newStatus; card.movedAt = new Date().toISOString(); this.save(); }
        return card;
    },

    deleteCard(id) {
        const index = this.state.cards.findIndex(c => c.id === id);
        if (index !== -1) { this.state.cards.splice(index, 1); this.save(); }
    },

    getCardsByStatus(status) {
        return this.state.cards.filter(c => c.status === status);
    }
};

// Gerencia a manipulação do DOM
const DOMManager = {
    containers: { todo: null, doing: null, done: null },
    counters: { todo: null, doing: null, done: null },

    init() {
        this.containers = {
            todo: document.getElementById('todo'),
            doing: document.getElementById('doing'),
            done: document.getElementById('done')
        };
        this.counters = {
            todo: document.getElementById('count-todo'),
            doing: document.getElementById('count-doing'),
            done: document.getElementById('count-done')
        };
    },

    updateCounter(status) {
        if (this.counters[status])
            this.counters[status].textContent = StateManager.getCardsByStatus(status).length;
    },

    updateAllCounters() {
        Object.keys(this.counters).forEach(s => this.updateCounter(s));
    },

    // Exibe ou remove a mensagem "Nenhum card aqui" na coluna
    updateEmptyMessage(status) {
        const container = this.containers[status];
        if (!container) return;
        const existing = container.querySelector('.empty-message');
        const empty = StateManager.getCardsByStatus(status).length === 0;
        if (empty && !existing) {
            const msg = document.createElement('p');
            msg.className = 'empty-message';
            msg.textContent = 'Nenhum card aqui';
            container.appendChild(msg);
        } else if (!empty && existing) {
            existing.remove();
        }
    },

    updateAllEmptyMessages() {
        ['todo', 'doing', 'done'].forEach(s => this.updateEmptyMessage(s));
    },

    // RN06 - Desabilita o botão quando o limite total é atingido
    updateNewCardButton() {
        const btn = document.getElementById('btnNovoCard');
        if (!btn) return;
        const limitReached = StateManager.state.cards.length >= BusinessRules.MAX_CARDS;
        btn.disabled = limitReached;
        btn.style.opacity = limitReached ? '0.5' : '';
        btn.style.cursor = limitReached ? 'not-allowed' : '';
        btn.title = limitReached ? `Limite de ${BusinessRules.MAX_CARDS} cards atingido` : '';
    },

    clearAllCards() {
        Object.values(this.containers).forEach(c => c.innerHTML = '');
    },

    renderAllCards() {
        this.clearAllCards();
        StateManager.state.cards.forEach(card => this.renderCard(card));
        this.updateAllCounters();
        this.updateAllEmptyMessages();
        this.updateNewCardButton();
    },

    // Cria o elemento HTML do card
    createCardElement(card) {
        const el = document.createElement('div');
        el.className = 'card';
        el.id = `card-${card.id}`;
        el.draggable = true;
        el.setAttribute('data-id', card.id);

        const span = document.createElement('span');
        span.className = 'card__text';
        span.textContent = card.text;

        const btn = document.createElement('button');
        btn.className = 'card__delete';
        btn.innerHTML = '&times;';
        btn.title = 'Excluir card';
        btn.addEventListener('click', e => { e.stopPropagation(); CardManager.deleteCard(card.id); });

        el.appendChild(span);
        el.appendChild(btn);
        return el;
    },

    renderCard(card) {
        const el = this.createCardElement(card);
        const container = this.containers[card.status];
        if (container) {
            container.appendChild(el);
            DragDropManager.setupCardDragEvents(el);
            CardManager.setupCardClickEvents(el, card.id);
        }
    }
};

// Gerencia o Drag and Drop entre colunas
const DragDropManager = {
    draggedCard: null,

    init() {
        Object.values(DOMManager.containers).forEach(c => {
            c.addEventListener('dragover', this.handleDragOver.bind(this));
            c.addEventListener('dragenter', this.handleDragEnter.bind(this));
            c.addEventListener('dragleave', this.handleDragLeave.bind(this));
            c.addEventListener('drop', this.handleDrop.bind(this));
        });
    },

    setupCardDragEvents(el) {
        el.addEventListener('dragstart', this.handleDragStart.bind(this));
        el.addEventListener('dragend', this.handleDragEnd.bind(this));
    },

    handleDragStart(e) {
        this.draggedCard = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-id'));
    },

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedCard = null;
        Object.values(DOMManager.containers).forEach(c => c.classList.remove('drag-over'));
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },

    handleDragEnter(e) {
        e.preventDefault();
        Object.values(DOMManager.containers).forEach(c => c.classList.remove('drag-over'));
        const container = e.target.closest('.card-container');
        if (container) container.classList.add('drag-over');
    },

    handleDragLeave(e) {
        const container = e.target.closest('.card-container');
        if (container && !container.contains(e.relatedTarget))
            container.classList.remove('drag-over');
    },

    handleDrop(e) {
        e.preventDefault();
        const container = e.target.closest('.card-container');
        if (!container || !this.draggedCard) return;

        const cardId = parseInt(this.draggedCard.getAttribute('data-id'));
        const newStatus = container.id;
        const card = StateManager.state.cards.find(c => c.id === cardId);
        if (!card) return;

        // RN03 - Verifica se o card está tentando voltar para coluna anterior
        const backwardCheck = BusinessRules.canMoveBackward(card.status, newStatus);
        if (!backwardCheck.ok) { Notify.show(backwardCheck.message); container.classList.remove('drag-over'); return; }

        // RN01 - Verifica o limite WIP ao mover para "Fazendo"
        if (card.status !== newStatus) {
            const wipCheck = BusinessRules.canMoveToColumn(newStatus);
            if (!wipCheck.ok) { Notify.show(wipCheck.message); container.classList.remove('drag-over'); return; }
        }

        StateManager.moveCard(cardId, newStatus);
        container.appendChild(this.draggedCard);
        DOMManager.updateAllCounters();
        DOMManager.updateAllEmptyMessages();
        container.classList.remove('drag-over');
    }
};

// Gerencia criação, edição e exclusão de cards
const CardManager = {
    modal: null,

    init() {
        this.setupModal();
        this.setupNewCardButton();
    },

    setupModal() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <h3 class="modal__title" id="modalTitle">Novo Card</h3>
                    <input type="text" class="modal__input" id="modalInput" placeholder="Digite o texto do card...">
                    <p class="modal__hint">Mínimo de ${BusinessRules.MIN_TITLE_LENGTH} caracteres</p>
                    <div class="modal__actions">
                        <button class="modal__button modal__button--secondary" id="btnCancelar">Cancelar</button>
                        <button class="modal__button modal__button--primary" id="btnSalvar">Salvar</button>
                    </div>
                </div>
            </div>
        `);

        this.modal = {
            overlay: document.getElementById('modalOverlay'),
            title: document.getElementById('modalTitle'),
            input: document.getElementById('modalInput'),
            btnCancel: document.getElementById('btnCancelar'),
            btnSave: document.getElementById('btnSalvar')
        };

        this.modal.btnCancel.addEventListener('click', () => this.closeModal());
        this.modal.btnSave.addEventListener('click', () => this.handleSave());
        this.modal.overlay.addEventListener('click', e => { if (e.target === this.modal.overlay) this.closeModal(); });

        // Fecha com ESC ou salva com Enter
        document.addEventListener('keydown', e => {
            if (!this.modal.overlay.classList.contains('active')) return;
            if (e.key === 'Escape') this.closeModal();
            else if (e.key === 'Enter') this.handleSave();
        });
    },

    openModal(title = 'Novo Card', defaultText = '', editId = null) {
        this.modal.title.textContent = title;
        this.modal.input.value = defaultText;
        this.modal.input.setAttribute('data-edit-id', editId || '');
        this.modal.overlay.classList.add('active');
        this.modal.input.focus();
    },

    closeModal() {
        this.modal.overlay.classList.remove('active');
        this.modal.input.value = '';
        this.modal.input.style.borderColor = '';
        this.modal.input.removeAttribute('data-edit-id');
    },

    handleSave() {
        const text = this.modal.input.value.trim();
        const editId = this.modal.input.getAttribute('data-edit-id');

        // Valida campo vazio
        if (!text) {
            this.modal.input.style.borderColor = '#f44336';
            setTimeout(() => this.modal.input.style.borderColor = '', 1000);
            this.modal.input.focus();
            return;
        }

        // RN02 - Valida tamanho mínimo do título
        const titleCheck = BusinessRules.validateTitle(text);
        if (!titleCheck.ok) {
            this.modal.input.style.borderColor = '#f44336';
            setTimeout(() => this.modal.input.style.borderColor = '', 1000);
            Notify.show(titleCheck.message);
            return;
        }

        if (editId) {
            const card = StateManager.state.cards.find(c => c.id === parseInt(editId));
            // RN05 - Verifica duplicidade ao editar
            const dupCheck = BusinessRules.hasDuplicateTitle(text, card.status, parseInt(editId));
            if (!dupCheck.ok) { Notify.show(dupCheck.message); return; }
            this.editCard(parseInt(editId), text);
        } else {
            // RN06 - Verifica limite total de cards
            const limitCheck = BusinessRules.canAddCard();
            if (!limitCheck.ok) { Notify.show(limitCheck.message); return; }
            // RN05 - Verifica duplicidade ao criar
            const dupCheck = BusinessRules.hasDuplicateTitle(text, 'todo');
            if (!dupCheck.ok) { Notify.show(dupCheck.message); return; }
            this.createCard(text);
        }

        this.closeModal();
    },

    setupNewCardButton() {
        const btn = document.getElementById('btnNovoCard');
        if (btn) {
            btn.addEventListener('click', () => {
                const limitCheck = BusinessRules.canAddCard();
                if (!limitCheck.ok) { Notify.show(limitCheck.message); return; }
                this.openModal('Novo Card');
            });
        }
    },

    // Abre modal de edição ao dar duplo clique no card
    setupCardClickEvents(el, cardId) {
        el.addEventListener('dblclick', e => {
            if (e.target.classList.contains('card__delete')) return;
            const card = StateManager.state.cards.find(c => c.id === cardId);
            if (card) this.openModal('Editar Card', card.text, card.id);
        });
    },

    createCard(text) {
        const card = StateManager.addCard(text);
        DOMManager.renderCard(card);
        DOMManager.updateCounter(card.status);
        DOMManager.updateEmptyMessage(card.status);
        DOMManager.updateNewCardButton();
    },

    editCard(id, newText) {
        const card = StateManager.updateCard(id, newText);
        if (card) {
            const el = document.getElementById(`card-${id}`);
            if (el) el.querySelector('.card__text').textContent = newText;
        }
    },

    // RN04 - Pede confirmação antes de excluir o card
    deleteCard(id) {
        if (!confirm('Tem certeza que deseja excluir este card?')) return;

        const el = document.getElementById(`card-${id}`);
        const status = StateManager.state.cards.find(c => c.id === id)?.status;

        if (el) {
            el.style.transition = 'opacity 0.15s, transform 0.15s';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
            setTimeout(() => {
                el.remove();
                StateManager.deleteCard(id);
                DOMManager.updateAllCounters();
                DOMManager.updateAllEmptyMessages();
                DOMManager.updateNewCardButton();
            }, 150);
        } else {
            StateManager.deleteCard(id);
            DOMManager.updateAllCounters();
            DOMManager.updateNewCardButton();
        }
    }
};

// Inicializa todos os módulos quando o DOM estiver pronto
const App = {
    init() {
        StateManager.load();
        DOMManager.init();
        DragDropManager.init();
        CardManager.init();
        DOMManager.renderAllCards();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());