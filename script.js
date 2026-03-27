/**
 * ===========================================
 * QUADRO KANBAN - Sistema de Gerenciamento de Tarefas
 * ===========================================
 *
 * Funcionalidades:
 * - Criar, editar e excluir cards
 * - Arrastar e soltar (Drag and Drop)
 * - Persistência com LocalStorage
 * - Design responsivo
 * - Contador de cards por coluna
 * - Mensagem de coluna vazia
 * - Salvar com Enter
 *
 * Versão: 1.1.0
 */

// ===========================================
// MÓDULO: Gerenciamento de Estado
// ===========================================
const StateManager = {
    STORAGE_KEY: 'kanban_board_state',

    state: {
        cards: [],
        nextId: 1
    },

    load() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = parsed;
            }
        } catch (error) {
            console.warn('Erro ao carregar estado:', error);
        }
        return this.state;
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (error) {
            console.warn('Erro ao salvar estado:', error);
        }
    },

    addCard(text, status = 'todo') {
        const card = {
            id: this.state.nextId++,
            text: text,
            status: status,
            createdAt: new Date().toISOString()
        };
        this.state.cards.push(card);
        this.save();
        return card;
    },

    updateCard(id, newText) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) {
            card.text = newText;
            card.updatedAt = new Date().toISOString();
            this.save();
        }
        return card;
    },

    moveCard(id, newStatus) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) {
            card.status = newStatus;
            card.movedAt = new Date().toISOString();
            this.save();
        }
        return card;
    },

    deleteCard(id) {
        const index = this.state.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            this.state.cards.splice(index, 1);
            this.save();
        }
    },

    getCardsByStatus(status) {
        return this.state.cards.filter(c => c.status === status);
    }
};

// ===========================================
// MÓDULO: Gerenciamento do DOM
// ===========================================
const DOMManager = {
    containers: {
        todo: null,
        doing: null,
        done: null
    },

    counters: {
        todo: null,
        doing: null,
        done: null
    },

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
        const count = StateManager.getCardsByStatus(status).length;
        if (this.counters[status]) {
            this.counters[status].textContent = count;
        }
    },

    updateAllCounters() {
        Object.keys(this.counters).forEach(status => {
            this.updateCounter(status);
        });
    },

    /**
     * Atualiza mensagem de coluna vazia
     */
    updateEmptyMessage(status) {
        const container = this.containers[status];
        if (!container) return;

        const existing = container.querySelector('.empty-message');
        const count = StateManager.getCardsByStatus(status).length;

        if (count === 0) {
            if (!existing) {
                const msg = document.createElement('p');
                msg.className = 'empty-message';
                msg.textContent = 'Nenhum card aqui';
                container.appendChild(msg);
            }
        } else {
            if (existing) existing.remove();
        }
    },

    updateAllEmptyMessages() {
        ['todo', 'doing', 'done'].forEach(status => {
            this.updateEmptyMessage(status);
        });
    },

    clearAllCards() {
        Object.values(this.containers).forEach(container => {
            container.innerHTML = '';
        });
    },

    renderAllCards() {
        this.clearAllCards();
        StateManager.state.cards.forEach(card => {
            this.renderCard(card);
        });
        this.updateAllCounters();
        this.updateAllEmptyMessages();
    },

    createCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.id = `card-${card.id}`;
        cardElement.draggable = true;
        cardElement.setAttribute('data-id', card.id);

        const textSpan = document.createElement('span');
        textSpan.className = 'card__text';
        textSpan.textContent = card.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'card__delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Excluir card';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            CardManager.deleteCard(card.id);
        });

        cardElement.appendChild(textSpan);
        cardElement.appendChild(deleteBtn);

        return cardElement;
    },

    renderCard(card) {
        const cardElement = this.createCardElement(card);
        const container = this.containers[card.status];

        if (container) {
            container.appendChild(cardElement);
            DragDropManager.setupCardDragEvents(cardElement);
            CardManager.setupCardClickEvents(cardElement, card.id);
        }
    }
};

// ===========================================
// MÓDULO: Gerenciamento de Drag and Drop
// ===========================================
const DragDropManager = {
    draggedCard: null,

    init() {
        Object.values(DOMManager.containers).forEach(container => {
            container.addEventListener('dragover', this.handleDragOver.bind(this));
            container.addEventListener('dragenter', this.handleDragEnter.bind(this));
            container.addEventListener('dragleave', this.handleDragLeave.bind(this));
            container.addEventListener('drop', this.handleDrop.bind(this));
        });
    },

    setupCardDragEvents(cardElement) {
        cardElement.addEventListener('dragstart', this.handleDragStart.bind(this));
        cardElement.addEventListener('dragend', this.handleDragEnd.bind(this));
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

        Object.values(DOMManager.containers).forEach(container => {
            container.classList.remove('drag-over');
        });
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },

    handleDragEnter(e) {
        e.preventDefault();
        // Remove de todos primeiro, depois aplica só no destino
        Object.values(DOMManager.containers).forEach(c => c.classList.remove('drag-over'));
        const container = e.target.closest('.card-container');
        if (container) {
            container.classList.add('drag-over');
        }
    },

    handleDragLeave(e) {
        const container = e.target.closest('.card-container');
        if (container && !container.contains(e.relatedTarget)) {
            container.classList.remove('drag-over');
        }
    },

    handleDrop(e) {
        e.preventDefault();
        const container = e.target.closest('.card-container');

        if (container && this.draggedCard) {
            const cardId = parseInt(this.draggedCard.getAttribute('data-id'));
            const newStatus = container.id;

            StateManager.moveCard(cardId, newStatus);
            container.appendChild(this.draggedCard);

            DOMManager.updateAllCounters();
            DOMManager.updateAllEmptyMessages();

            container.classList.remove('drag-over');
        }
    }
};

// ===========================================
// MÓDULO: Gerenciamento de Cards
// ===========================================
const CardManager = {
    modal: null,

    init() {
        this.setupModal();
        this.setupNewCardButton();
    },

    setupModal() {
        const modalHTML = `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <h3 class="modal__title" id="modalTitle">Novo Card</h3>
                    <input type="text" class="modal__input" id="modalInput" placeholder="Digite o texto do card...">
                    <div class="modal__actions">
                        <button class="modal__button modal__button--secondary" id="btnCancelar">Cancelar</button>
                        <button class="modal__button modal__button--primary" id="btnSalvar">Salvar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        this.modal = {
            overlay: document.getElementById('modalOverlay'),
            title: document.getElementById('modalTitle'),
            input: document.getElementById('modalInput'),
            btnCancel: document.getElementById('btnCancelar'),
            btnSave: document.getElementById('btnSalvar')
        };

        this.modal.btnCancel.addEventListener('click', () => this.closeModal());
        this.modal.btnSave.addEventListener('click', () => this.handleSave());
        this.modal.overlay.addEventListener('click', (e) => {
            if (e.target === this.modal.overlay) {
                this.closeModal();
            }
        });

        // Fechar com ESC ou salvar com Enter
        document.addEventListener('keydown', (e) => {
            if (!this.modal.overlay.classList.contains('active')) return;

            if (e.key === 'Escape') {
                this.closeModal();
            } else if (e.key === 'Enter') {
                this.handleSave();
            }
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
        this.modal.input.removeAttribute('data-edit-id');
    },

    handleSave() {
        const text = this.modal.input.value.trim();
        const editId = this.modal.input.getAttribute('data-edit-id');

        if (!text) {
            this.modal.input.focus();
            this.modal.input.style.borderColor = '#f44336';
            setTimeout(() => {
                this.modal.input.style.borderColor = '';
            }, 1000);
            return;
        }

        if (editId) {
            this.editCard(parseInt(editId), text);
        } else {
            this.createCard(text);
        }

        this.closeModal();
    },

    setupNewCardButton() {
        const btnNovoCard = document.getElementById('btnNovoCard');
        if (btnNovoCard) {
            btnNovoCard.addEventListener('click', () => {
                this.openModal('Novo Card');
            });
        }
    },

    setupCardClickEvents(cardElement, cardId) {
        cardElement.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('card__delete')) return;

            const card = StateManager.state.cards.find(c => c.id === cardId);
            if (card) {
                this.openModal('Editar Card', card.text, card.id);
            }
        });
    },

    createCard(text) {
        const card = StateManager.addCard(text);
        DOMManager.renderCard(card);
        DOMManager.updateCounter(card.status);
        DOMManager.updateEmptyMessage(card.status);
    },

    editCard(id, newText) {
        const card = StateManager.updateCard(id, newText);
        if (card) {
            const cardElement = document.getElementById(`card-${id}`);
            if (cardElement) {
                cardElement.querySelector('.card__text').textContent = newText;
            }
        }
    },

    deleteCard(id) {
        const cardElement = document.getElementById(`card-${id}`);
        const status = StateManager.state.cards.find(c => c.id === id)?.status;

        if (cardElement) {
            cardElement.style.transition = 'opacity 0.15s, transform 0.15s';
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                cardElement.remove();
                StateManager.deleteCard(id);
                DOMManager.updateAllCounters();
                if (status) DOMManager.updateEmptyMessage(status);
            }, 150);
        } else {
            StateManager.deleteCard(id);
            DOMManager.updateAllCounters();
        }
    }
};

// ===========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ===========================================
const App = {
    init() {
        console.log('🚀 Iniciando Quadro Kanban...');

        StateManager.load();
        DOMManager.init();
        DragDropManager.init();
        CardManager.init();
        DOMManager.renderAllCards();

        console.log('✅ Quadro Kanban inicializado com sucesso!');
        console.log(`📊 Total de cards: ${StateManager.state.cards.length}`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.KanbanApp = {
    StateManager,
    DOMManager,
    DragDropManager,
    CardManager,
    App
};