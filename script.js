// Este objeto centraliza todas as validações e regras que o sistema deve seguir.
const BusinessRules = {
    // Constantes 
    WIP_LIMIT: 3,        // RN01: Máximo de cards na coluna "Fazendo"
    MAX_CARDS: 20,       // RN06: Máximo de cards no quadro todo
    MIN_TITLE_LENGTH: 3, // RN02: Mínimo de caracteres no título
    COLUMN_ORDER: ['todo', 'doing', 'done'], // Ordem das colunas

    /** RN01 - Verifica se pode mover card para uma coluna
     @param {string} newStatus - Status de destino
     @returns {object} - { ok: boolean, message?: string } */
    canMoveToColumn(newStatus) {
        // Se não for coluna "doing", não há restrição
        if (newStatus !== 'doing') return { ok: true };

        // Conta cards atuais na coluna "doing"
        const count = StateManager.getCardsByStatus('doing').length;

        // Verifica se já atingiu o limite
        if (count >= this.WIP_LIMIT)
            return { ok: false, message: `Limite atingido! A coluna "Fazendo" permite no máximo ${this.WIP_LIMIT} cards. Conclua um card antes de adicionar outro.` };

        return { ok: true };
    },

    /** RN02 - Valida o tamanho mínimo do título
      @param {string} text - Texto do título
      @returns {object} - { ok: boolean, message?: string } */
    validateTitle(text) {
        if (text.length < this.MIN_TITLE_LENGTH)
            return { ok: false, message: `O título deve ter no mínimo ${this.MIN_TITLE_LENGTH} caracteres.` };
        return { ok: true };
    },

    /**
     * RN03 - Verifica se o card está voltando para coluna anterior, os cards só podem avançar, não podem retroceder
     * @param {string} currentStatus - Status atual do card
     * @param {string} newStatus - Status de destino
     * @returns {object} - { ok: boolean, message?: string } */
    canMoveBackward(currentStatus, newStatus) {
        const currentIndex = this.COLUMN_ORDER.indexOf(currentStatus);
        const newIndex = this.COLUMN_ORDER.indexOf(newStatus);

        // Se o índice novo for menor que o atual, está voltando
        if (newIndex < currentIndex)
            return { ok: false, message: 'Um card não pode voltar para uma coluna anterior.' };

        return { ok: true };
    },

    /** RN05 - Verifica se já existe card com mesmo título na coluna, não pode cards duplicados na mesma coluna
     * @param {string} text - Texto do título
     * @param {string} status - Status da coluna
     * @param {number|null} excludeId - ID a excluir da verificação (para edição)
     * @returns {object} - { ok: boolean, message?: string } */
    hasDuplicateTitle(text, status, excludeId = null) {
        const duplicate = StateManager.getCardsByStatus(status)
            .find(c => c.text.toLowerCase() === text.toLowerCase() && c.id !== excludeId);

        if (duplicate)
            return { ok: false, message: 'Já existe um card com este título nesta coluna.' };

        return { ok: true };
    },

    /** RN06 - Verifica se pode adicionar novo card (limite total)
     * @returns {object} - { ok: boolean, message?: string } */
    canAddCard() {
        if (StateManager.state.cards.length >= this.MAX_CARDS)
            return { ok: false, message: `Limite de ${this.MAX_CARDS} cards atingido! Exclua um card para adicionar outro.` };

        return { ok: true };
    }
};

// Sistemas de Notificações (Notify) -> Exibe mensagens de feedback na parte inferior da tela para informar o usuário sobre erros.
const Notify = {
    /** Exibe uma notificação toast na tela
     * @param {string} message - Mensagem a ser exibida */
    show(message) {
        // Remove notificação existente se houver
        const existing = document.querySelector('.kanban-notify');
        if (existing) existing.remove();

        // Cria elemento da notificação
        const notify = document.createElement('div');
        notify.className = 'kanban-notify';
        notify.textContent = message;
        document.body.appendChild(notify);

        // Força reflow para animação funcionar
        // Reflow --> Força o navegador a recalcular o layout QUANDO vocÊ adiciona um elemento no DOM
        notify.offsetHeight;
        notify.classList.add('kanban-notify--visible');

        // Remove após 3 segundos
        setTimeout(() => {
            notify.classList.remove('kanban-notify--visible');
            setTimeout(() => notify.remove(), 300);
        }, 3000);
    }
};

// Gerenciador de Estado (StateManager) --> Responsável por:
// - Manter o estado da aplicação em memória
// - Persistir dados no LocalStorage (RNF05)
// - Fornecer métodos CRUD para cards
const StateManager = {
    STORAGE_KEY: 'kanban_board_state', // Chave do LocalStorage
    state: { cards: [], nextId: 1 },   // Estado inicial

    /** Carrega o estado salvo do LocalStorage
     * @returns {object} - Estado carregado */
    load() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) this.state = JSON.parse(saved);
        } catch (e) {
            // Se houver erro, mantém estado inicial
            console.warn('Não foi possível carregar estado salvo:', e);
        }
        return this.state;
    },

    /** Salva o estado atual no LocalStorage */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.warn('Não foi possível salvar estado:', e);
        }
    },

    /** Adiciona um novo card ao estado
     * @param {string} text - Texto do card
     * @param {string} status - Status inicial (padrão: 'todo')
     * @returns {object} - Card criado */
    addCard(text, status = 'todo') {
        const card = {
            id: this.state.nextId++,
            text,
            status,
            createdAt: new Date().toISOString()
        };
        this.state.cards.push(card);
        this.save();
        return card;
    },

    /** Atualiza o texto de um card existente
     * @param {number} id - ID do card
     * @param {string} newText - Novo texto
     * @returns {object|null} - Card atualizado ou null */
    updateCard(id, newText) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) {
            card.text = newText;
            card.updatedAt = new Date().toISOString();
            this.save();
        }
        return card;
    },

    /** Move um card para outra coluna
     * @param {number} id - ID do card
     * @param {string} newStatus - Novo status
     * @returns {object|null} - Card movido ou null */
    moveCard(id, newStatus) {
        const card = this.state.cards.find(c => c.id === id);
        if (card) {
            card.status = newStatus;
            card.movedAt = new Date().toISOString();
            this.save();
        }
        return card;
    },

    /** Remove um card do estado
     * @param {number} id - ID do card*/
    deleteCard(id) {
        const index = this.state.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            this.state.cards.splice(index, 1);
            this.save();
        }
    },

    /** Retorna todos os cards de uma coluna específica
     * @param {string} status - Status da coluna
     * @returns {array} - Lista de cards*/
    getCardsByStatus(status) {
        return this.state.cards.filter(c => c.status === status);
    }
};

// Gerenciador de DOM (DOMManager) -> Responsável por:
// - Manipular elementos HTML
// - Renderizar cards na tela
// - Atualizar contadores e mensagens
const DOMManager = {
    // Referências aos containers de cards
    containers: { todo: null, doing: null, done: null },
    // Referências aos contadores
    counters: { todo: null, doing: null, done: null },

    /** Inicializa referências aos elementos do DOM*/
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

    /** Atualiza o contador de uma coluna específica
     * @param {string} status - Status da coluna */
    updateCounter(status) {
        if (this.counters[status])
            this.counters[status].textContent = StateManager.getCardsByStatus(status).length;
    },

    /** Atualiza todos os contadores */
    updateAllCounters() {
        Object.keys(this.counters).forEach(s => this.updateCounter(s));
    },

    /** Atualiza a mensagem de coluna vazia
     * @param {string} status - Status da coluna */
    updateEmptyMessage(status) {
        const container = this.containers[status];
        if (!container) return;

        const existing = container.querySelector('.empty-message');
        const empty = StateManager.getCardsByStatus(status).length === 0;

        if (empty && !existing) {
            // Adiciona mensagem se coluna está vazia
            const msg = document.createElement('p');
            msg.className = 'empty-message';
            msg.textContent = 'Nenhum card aqui';
            container.appendChild(msg);
        } else if (!empty && existing) {
            // Remove mensagem se coluna tem cards
            existing.remove();
        }
    },

    /* Atualiza todas as mensagens de coluna vazia */
    updateAllEmptyMessages() {
        ['todo', 'doing', 'done'].forEach(s => this.updateEmptyMessage(s));
    },

    /* RN06 - Atualiza estado do botão de novo card: Desabilita quando limite total é atingido */
    updateNewCardButton() {
        const btn = document.getElementById('btnNovoCard');
        if (!btn) return;

        const limitReached = StateManager.state.cards.length >= BusinessRules.MAX_CARDS;
        btn.disabled = limitReached;
        btn.style.opacity = limitReached ? '0.5' : '';
        btn.style.cursor = limitReached ? 'not-allowed' : '';
        btn.title = limitReached ? `Limite de ${BusinessRules.MAX_CARDS} cards atingido` : '';
    },

    /* Limpa todos os cards do DOM */
    clearAllCards() {
        Object.values(this.containers).forEach(c => c.innerHTML = '');
    },

    /* Renderiza todos os cards na tela */
    renderAllCards() {
        this.clearAllCards();
        StateManager.state.cards.forEach(card => this.renderCard(card));
        this.updateAllCounters();
        this.updateAllEmptyMessages();
        this.updateNewCardButton();
    },

    /** Cria o elemento HTML de um card
     * @param {object} card - Dados do card
     * @returns {HTMLElement} - Elemento do card */
    createCardElement(card) {
        const el = document.createElement('div');
        el.className = 'card';
        el.id = `card-${card.id}`;
        el.draggable = true; // Habilita drag and drop 
        el.setAttribute('data-id', card.id);

        // Texto do card
        const span = document.createElement('span');
        span.className = 'card__text';
        span.textContent = card.text;

        // Botão de excluir
        const btn = document.createElement('button');
        btn.className = 'card__delete';
        btn.innerHTML = '&times;';
        btn.title = 'Excluir card';
        btn.addEventListener('click', e => {
            e.stopPropagation(); // Impede propagação do evento
            CardManager.deleteCard(card.id);
        });

        el.appendChild(span);
        el.appendChild(btn);
        return el;
    },

    /** Renderiza um card específico na coluna correta
     * @param {object} card - Dados do card */
    renderCard(card) {
        const el = this.createCardElement(card);
        const container = this.containers[card.status];

        if (container) {
            container.appendChild(el);
            // Configura eventos de drag
            DragDropManager.setupCardDragEvents(el);
            // Configura eventos de clique para edição
            CardManager.setupCardClickEvents(el, card.id);
        }
    }
};

// Gerenciador do Drag and Drop (DragDropManager) -> Implementa a API de Drag and Drop do HTML e permite arrastar cards entre as colunas
const DragDropManager = {
    draggedCard: null, // Referência ao card sendo arrastado

    /* Inicializa eventos de drop nos containers */
    init() {
        Object.values(DOMManager.containers).forEach(c => {
            c.addEventListener('dragover', this.handleDragOver.bind(this));
            c.addEventListener('dragenter', this.handleDragEnter.bind(this));
            c.addEventListener('dragleave', this.handleDragLeave.bind(this));
            c.addEventListener('drop', this.handleDrop.bind(this));
        });
    },

    /** Configura eventos de drag nos cards
     * @param {HTMLElement} el - Elemento do card */
    setupCardDragEvents(el) {
        el.addEventListener('dragstart', this.handleDragStart.bind(this));
        el.addEventListener('dragend', this.handleDragEnd.bind(this));
    },

    /** Evento: Início do arraste
     * @param {DragEvent} e - Evento de drag */
    handleDragStart(e) {
        this.draggedCard = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-id'));
    },

    /** Evento: Fim do arraste
     * @param {DragEvent} e - Evento de drag */
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedCard = null;
        // Remove destaque de todas as colunas
        Object.values(DOMManager.containers).forEach(c => c.classList.remove('drag-over'));
    },

    /** Evento: Card sobre a área de drop
     * @param {DragEvent} e - Evento de drag */
    handleDragOver(e) {
        e.preventDefault(); // Permite drop
        e.dataTransfer.dropEffect = 'move';
    },

    /** Evento: Card entra na área de drop
     * @param {DragEvent} e - Evento de drag */
    handleDragEnter(e) {
        e.preventDefault();
        // Remove destaque de todas as colunas
        Object.values(DOMManager.containers).forEach(c => c.classList.remove('drag-over'));
        // Adiciona destaque na coluna atual
        const container = e.target.closest('.card-container');
        if (container) container.classList.add('drag-over');
    },

    /** Evento: Card sai da área de drop
     * @param {DragEvent} e - Evento de drag */
    handleDragLeave(e) {
        const container = e.target.closest('.card-container');
        if (container && !container.contains(e.relatedTarget))
            container.classList.remove('drag-over');
    },

    /** Evento: Card é solto na área de drop
     * @param {DragEvent} e - Evento de drag */
    handleDrop(e) {
        e.preventDefault();

        const container = e.target.closest('.card-container');
        if (!container || !this.draggedCard) return;

        const cardId = parseInt(this.draggedCard.getAttribute('data-id'));
        const newStatus = container.id;
        const card = StateManager.state.cards.find(c => c.id === cardId);

        if (!card) return;

        // RN03: Verifica se está tentando voltar para coluna anterior
        const backwardCheck = BusinessRules.canMoveBackward(card.status, newStatus);
        if (!backwardCheck.ok) {
            Notify.show(backwardCheck.message);
            container.classList.remove('drag-over');
            return;
        }

        // RN01: Verifica limite (máximo de 3 cards) ao mover para "Fazendo"
        if (card.status !== newStatus) {
            const wipCheck = BusinessRules.canMoveToColumn(newStatus);
            if (!wipCheck.ok) {
                Notify.show(wipCheck.message);
                container.classList.remove('drag-over');
                return;
            }
        }

        // Move o card no estado e no DOM
        StateManager.moveCard(cardId, newStatus);
        container.appendChild(this.draggedCard);
        DOMManager.updateAllCounters();
        DOMManager.updateAllEmptyMessages();
        container.classList.remove('drag-over');
    }
};

// Gerenciador de Cards (CardManager) -> Responsável por:
// - Criar novos cards
// - Editar cards existentes
// - Excluir cards
// - Gerenciar modal de criação/edição
const CardManager = {
    modal: null, // Referência aos elementos do modal

    /* Inicializa o gerenciador de cards */
    init() {
        this.setupModal();
        this.setupNewCardButton();
    },

    /* Cria e configura o modal de criação/edição*/
    setupModal() {
        // Insere HTML do modal no body
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

        // Guarda referências aos elementos
        this.modal = {
            overlay: document.getElementById('modalOverlay'),
            title: document.getElementById('modalTitle'),
            input: document.getElementById('modalInput'),
            btnCancel: document.getElementById('btnCancelar'),
            btnSave: document.getElementById('btnSalvar')
        };

        // Evento: Cancelar
        this.modal.btnCancel.addEventListener('click', () => this.closeModal());

        // Evento: Salvar
        this.modal.btnSave.addEventListener('click', () => this.handleSave());

        // Evento: Fechar clicando fora
        this.modal.overlay.addEventListener('click', e => {
            if (e.target === this.modal.overlay) this.closeModal();
        });

        // Atalhos de teclado
        document.addEventListener('keydown', e => {
            if (!this.modal.overlay.classList.contains('active')) return;
            if (e.key === 'Escape') this.closeModal();      // ESC fecha modal
            else if (e.key === 'Enter') this.handleSave();   // Enter salva
        });
    },

    /** Abre o modal para criar ou editar card
     * @param {string} title - Título do modal
     * @param {string} defaultText - Texto inicial do input
     * @param {number|null} editId - ID do card sendo editado */
    openModal(title = 'Novo Card', defaultText = '', editId = null) {
        this.modal.title.textContent = title;
        this.modal.input.value = defaultText;
        this.modal.input.setAttribute('data-edit-id', editId || '');
        this.modal.overlay.classList.add('active');
        this.modal.input.focus();
    },

    /* Fecha o modal */
    closeModal() {
        this.modal.overlay.classList.remove('active');
        this.modal.input.value = '';
        this.modal.input.style.borderColor = '';
        this.modal.input.removeAttribute('data-edit-id');
    },

    /* Processa o salvamento do card (criar ou editar) */
    handleSave() {
        const text = this.modal.input.value.trim();
        const editId = this.modal.input.getAttribute('data-edit-id');

        // Validação: campo vazio
        if (!text) {
            this.modal.input.style.borderColor = '#f44336';
            setTimeout(() => this.modal.input.style.borderColor = '', 1000);
            this.modal.input.focus();
            return;
        }

        // RN02: Valida tamanho mínimo do título
        const titleCheck = BusinessRules.validateTitle(text);
        if (!titleCheck.ok) {
            this.modal.input.style.borderColor = '#f44336';
            setTimeout(() => this.modal.input.style.borderColor = '', 1000);
            Notify.show(titleCheck.message);
            return;
        }

        if (editId) {
            // Modo edição
            const card = StateManager.state.cards.find(c => c.id === parseInt(editId));

            // RN05: Verifica duplicidade ao editar
            const dupCheck = BusinessRules.hasDuplicateTitle(text, card.status, parseInt(editId));
            if (!dupCheck.ok) {
                Notify.show(dupCheck.message);
                return;
            }

            this.editCard(parseInt(editId), text);
        } else {
            // Modo criação

            // RN06: Verifica limite total de cards
            const limitCheck = BusinessRules.canAddCard();
            if (!limitCheck.ok) {
                Notify.show(limitCheck.message);
                return;
            }

            // RN05: Verifica duplicidade ao criar
            const dupCheck = BusinessRules.hasDuplicateTitle(text, 'todo');
            if (!dupCheck.ok) {
                Notify.show(dupCheck.message);
                return;
            }

            this.createCard(text);
        }

        this.closeModal();
    },

    /* Configura o botão de novo card */
    setupNewCardButton() {
        const btn = document.getElementById('btnNovoCard');
        if (btn) {
            btn.addEventListener('click', () => {
                // RN06: Verifica limite antes de abrir modal
                const limitCheck = BusinessRules.canAddCard();
                if (!limitCheck.ok) {
                    Notify.show(limitCheck.message);
                    return;
                }
                this.openModal('Novo Card');
            });
        }
    },

    /** Configura eventos de clique nos cards (edição)
     * @param {HTMLElement} el - Elemento do card
     * @param {number} cardId - ID do card */

    setupCardClickEvents(el, cardId) {
        // Duplo clique para editar
        el.addEventListener('dblclick', e => {
            // Ignora se clicou no botão de excluir
            if (e.target.classList.contains('card__delete')) return;

            const card = StateManager.state.cards.find(c => c.id === cardId);
            if (card) {
                this.openModal('Editar Card', card.text, card.id);
            }
        });
    },

    /**
     * Cria um novo card
     * @param {string} text - Texto do card */
    createCard(text) {
        const card = StateManager.addCard(text);
        DOMManager.renderCard(card);
        DOMManager.updateCounter(card.status);
        DOMManager.updateEmptyMessage(card.status);
        DOMManager.updateNewCardButton();
    },

    /** Edita um card existente
     * @param {number} id - ID do card
     * @param {string} newText - Novo texto */
    editCard(id, newText) {
        const card = StateManager.updateCard(id, newText);
        if (card) {
            const el = document.getElementById(`card-${id}`);
            if (el) {
                el.querySelector('.card__text').textContent = newText;
            }
        }
    },

    /** RN04 - Exclui um card com confirmação
     * @param {number} id - ID do card */
    deleteCard(id) {
        // Pede confirmação antes de excluir
        if (!confirm('Tem certeza que deseja excluir este card?')) return;

        const el = document.getElementById(`card-${id}`);
        const status = StateManager.state.cards.find(c => c.id === id)?.status;

        if (el) {
            // Animação de fade out
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

// Iniciando a Aplicação: Ponto de entrada que inicializa todos os módulos quando o DOM estiver pronto.
const App = {
    /* Inicializa a aplicação */
    init() {

        // Carrega estado salvo do LocalStorage
        StateManager.load();

        // Inicializa gerenciadores
        DOMManager.init();
        DragDropManager.init();
        CardManager.init();

        // Renderiza todos os cards 
        DOMManager.renderAllCards();
    }
};

// Inicia quando o DOM estiver carregado;
document.addEventListener('DOMContentLoaded', () => App.init());