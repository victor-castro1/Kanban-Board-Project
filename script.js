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
 *
 * Autor: Equipe de Desenvolvimento
 * Versão: 1.0.0
 */

// ===========================================
// MÓDULO: Gerenciamento de Estado
// ===========================================
const StateManager = {
    /**
     * Chave para armazenamento no LocalStorage
     */
    STORAGE_KEY: 'kanban_board_state',

    /**
     * Estado inicial do quadro
     */
    state: {
        cards: [],
        nextId: 1
    },

    /**
     * Carrega o estado do LocalStorage
     */
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

    /**
     * Salva o estado no LocalStorage
     */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (error) {
            console.warn('Erro ao salvar estado:', error);
        }
    },

    /**
     * Adiciona um novo card ao estado
     */
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

    /**
     * Atualiza um card existente
     */
    updateCard(id, newText) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) {
            card.text = newText;
            card.updatedAt = new Date().toISOString();
            this.save();
        }
        return card;
    },

    /**
     * Move um card para outra coluna
     */
    moveCard(id, newStatus) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) {
            card.status = newStatus;
            card.movedAt = new Date().toISOString();
            this.save();
        }
        return card;
    },

    /**
     * Remove um card
     */
    deleteCard(id) {
        const index = this.state.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            this.state.cards.splice(index, 1);
            this.save();
        }
    },

    /**
     * Obtém cards por status
     */
    getCardsByStatus(status) {
        return this.state.cards.filter(c => c.status === status);
    }
};

// ===========================================
// MÓDULO: Gerenciamento do DOM
// ===========================================
const DOMManager = {
    /**
     * Referências aos containers de cards
     */
    containers: {
        todo: null,
        doing: null,
        done: null
    },

    /**
     * Referências aos contadores
     */
    counters: {
        todo: null,
        doing: null,
        done: null
    },

    /**
     * Inicializa as referências do DOM
     */
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

    /**
     * Atualiza o contador de uma coluna
     */
    updateCounter(status) {
        const count = StateManager.getCardsByStatus(status).length;
        if (this.counters[status]) {
            this.counters[status].textContent = count;
        }
    },

    /**
     * Atualiza todos os contadores
     */
    updateAllCounters() {
        Object.keys(this.counters).forEach(status => {
            this.updateCounter(status);
        });
    },

    /**
     * Limpa todos os cards do DOM
     */
    clearAllCards() {
        Object.values(this.containers).forEach(container => {
            container.innerHTML = '';
        });
    },

    /**
     * Renderiza todos os cards do estado
     */
    renderAllCards() {
        this.clearAllCards();
        StateManager.state.cards.forEach(card => {
            this.renderCard(card);
        });
        this.updateAllCounters();
    },

    /**
     * Cria um elemento HTML para um card
     */
    createCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.id = `card-${card.id}`;
        cardElement.draggable = true;
        cardElement.setAttribute('data-id', card.id);

        // Texto do card
        const textSpan = document.createElement('span');
        textSpan.className = 'card__text';
        textSpan.textContent = card.text;

        // Botão de excluir
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

    /**
     * Renderiza um card no DOM
     */
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
    /**
     * Card sendo arrastado atualmente
     */
    draggedCard: null,

    /**
     * Inicializa os eventos de drag and drop
     */
    init() {
        // Configurar drop zones nos containers
        Object.values(DOMManager.containers).forEach(container => {
            container.addEventListener('dragover', this.handleDragOver.bind(this));
            container.addEventListener('dragenter', this.handleDragEnter.bind(this));
            container.addEventListener('dragleave', this.handleDragLeave.bind(this));
            container.addEventListener('drop', this.handleDrop.bind(this));
        });
    },

    /**
     * Configura eventos de drag em um card
     */
    setupCardDragEvents(cardElement) {
        cardElement.addEventListener('dragstart', this.handleDragStart.bind(this));
        cardElement.addEventListener('dragend', this.handleDragEnd.bind(this));
    },

    /**
     * Início do arraste
     */
    handleDragStart(e) {
        this.draggedCard = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-id'));
    },

    /**
     * Fim do arraste
     */
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedCard = null;

        // Remover classe de destaque de todos os containers
        Object.values(DOMManager.containers).forEach(container => {
            container.classList.remove('drag-over');
        });
    },

    /**
     * Enquanto arrasta sobre um container
     */
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },

    /**
     * Quando entra em um container
     */
    handleDragEnter(e) {
        e.preventDefault();
        const container = e.target.closest('.card-container');
        if (container) {
            container.classList.add('drag-over');
        }
    },

    /**
     * Quando sai de um container
     */
    handleDragLeave(e) {
        const container = e.target.closest('.card-container');
        if (container && !container.contains(e.relatedTarget)) {
            container.classList.remove('drag-over');
        }
    },

    /**
     * Quando solta em um container
     */
    handleDrop(e) {
        e.preventDefault();
        const container = e.target.closest('.card-container');

        if (container && this.draggedCard) {
            const cardId = parseInt(this.draggedCard.getAttribute('data-id'));
            const newStatus = container.id; // 'todo', 'doing', ou 'done'

            // Mover card no estado
            StateManager.moveCard(cardId, newStatus);

            // Mover card no DOM
            container.appendChild(this.draggedCard);

            // Atualizar contadores
            DOMManager.updateAllCounters();

            // Remover classe de destaque
            container.classList.remove('drag-over');
        }
    }
};

// ===========================================
// MÓDULO: Gerenciamento de Cards
// ===========================================
const CardManager = {
    /**
     * Modal de edição/criação
     */
    modal: null,

    /**
     * Inicializa o gerenciador de cards
     */
    init() {
        this.setupModal();
        this.setupNewCardButton();
    },

    /**
     * Configura o modal para criar/editar cards
     */
    setupModal() {
        // Criar estrutura do modal
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

        // Eventos do modal
        this.modal.btnCancel.addEventListener('click', () => this.closeModal());
        this.modal.btnSave.addEventListener('click', () => this.handleSave());
        this.modal.overlay.addEventListener('click', (e) => {
            if (e.target === this.modal.overlay) {
                this.closeModal();
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.overlay.classList.contains('active')) {
                this.closeModal();
            }
        });
    },

    /**
     * Abre o modal
     */
    openModal(title = 'Novo Card', defaultText = '', editId = null) {
        this.modal.title.textContent = title;
        this.modal.input.value = defaultText;
        this.modal.input.setAttribute('data-edit-id', editId || '');
        this.modal.overlay.classList.add('active');
        this.modal.input.focus();
    },

    /**
     * Fecha o modal
     */
    closeModal() {
        this.modal.overlay.classList.remove('active');
        this.modal.input.value = '';
        this.modal.input.removeAttribute('data-edit-id');
    },

    /**
     * Manipula o salvamento do modal
     */
    handleSave() {
        const text = this.modal.input.value.trim();
        const editId = this.modal.input.getAttribute('data-edit-id');

        if (!text) {
            this.modal.input.focus();
            return;
        }

        if (editId) {
            // Editar card existente
            this.editCard(parseInt(editId), text);
        } else {
            // Criar novo card
            this.createCard(text);
        }

        this.closeModal();
    },

    /**
     * Configura o botão de novo card
     */
    setupNewCardButton() {
        const btnNovoCard = document.getElementById('btnNovoCard');
        if (btnNovoCard) {
            btnNovoCard.addEventListener('click', () => {
                this.openModal('Novo Card');
            });
        }
    },

    /**
     * Configura eventos de clique em um card
     */
    setupCardClickEvents(cardElement, cardId) {
        // Duplo clique para editar
        cardElement.addEventListener('dblclick', (e) => {
            // Ignorar se clicou no botão de excluir
            if (e.target.classList.contains('card__delete')) return;

            const card = StateManager.state.cards.find(c => c.id === cardId);
            if (card) {
                this.openModal('Editar Card', card.text, card.id);
            }
        });
    },

    /**
     * Cria um novo card
     */
    createCard(text) {
        const card = StateManager.addCard(text);
        DOMManager.renderCard(card);
        DOMManager.updateCounter(card.status);
    },

    /**
     * Edita um card existente
     */
    editCard(id, newText) {
        const card = StateManager.updateCard(id, newText);
        if (card) {
            const cardElement = document.getElementById(`card-${id}`);
            if (cardElement) {
                cardElement.querySelector('.card__text').textContent = newText;
            }
        }
    },

    /**
     * Exclui um card
     */
    deleteCard(id) {
        StateManager.deleteCard(id);
        const cardElement = document.getElementById(`card-${id}`);
        if (cardElement) {
            cardElement.remove();
        }
        DOMManager.updateAllCounters();
    }
};

// ===========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ===========================================
const App = {
    /**
     * Inicializa a aplicação
     */
    init() {
        console.log('🚀 Iniciando Quadro Kanban...');

        // Carregar estado salvo
        StateManager.load();

        // Inicializar gerenciadores
        DOMManager.init();
        DragDropManager.init();
        CardManager.init();

        // Renderizar cards salvos
        DOMManager.renderAllCards();

        console.log('✅ Quadro Kanban inicializado com sucesso!');
        console.log(`📊 Total de cards: ${StateManager.state.cards.length}`);
    }
};

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Expor para debug (opcional)
window.KanbanApp = {
    StateManager,
    DOMManager,
    DragDropManager,
    CardManager,
    App
};