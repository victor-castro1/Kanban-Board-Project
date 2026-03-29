const LIMITE = { FAZENDO: 3, TOTAL: 20, MIN: 3 };
const ORDEM = ['todo', 'doing', 'done'];

let dados = JSON.parse(localStorage.getItem('kanban') || '{"cards":[],"id":1}');
const salvar = () => localStorage.setItem('kanban', JSON.stringify(dados));
const porStatus = s => dados.cards.filter(c => c.status === s);

const containers = {
    todo: document.getElementById('todo'),
    doing: document.getElementById('doing'),
    done: document.getElementById('done')
};

// ---- UI ----

function atualizarUI() {
    ['todo','doing','done'].forEach(s => {
        document.getElementById(`count-${s}`).textContent = porStatus(s).length;
        const c = containers[s];
        const vazio = c.querySelector('.empty-message');
        if (porStatus(s).length === 0 && !vazio)
            c.insertAdjacentHTML('beforeend', '<p class="empty-message">Nenhum card ainda</p>');
        else if (porStatus(s).length > 0 && vazio)
            vazio.remove();
    });
    const btn = document.getElementById('btnNovoCard');
    const cheio = dados.cards.length >= LIMITE.TOTAL;
    btn.disabled = cheio;
    btn.style.opacity = cheio ? '0.5' : '';
}

function criarCard(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.id = `card-${card.id}`;
    el.draggable = true;
    el.dataset.id = card.id;
    el.innerHTML = `<span class="card__text">${card.texto}</span><button class="card__delete" title="Excluir">&times;</button>`;

    el.querySelector('.card__delete').onclick = e => {
        e.stopPropagation();
        if (!confirm('Excluir este card?')) return;
        el.style.opacity = '0';
        setTimeout(() => {
            el.remove();
            dados.cards = dados.cards.filter(c => c.id !== card.id);
            salvar(); atualizarUI();
        }, 150);
    };

    el.addEventListener('dblclick', e => {
        if (e.target.classList.contains('card__delete')) return;
        const novo = prompt('Editar card:', card.texto)?.trim();
        if (!novo) return;
        if (novo.length < LIMITE.MIN) return alert(`Mínimo de ${LIMITE.MIN} caracteres.`);
        if (porStatus(card.status).find(c => c.texto.toLowerCase() === novo.toLowerCase() && c.id !== card.id))
            return alert('Já existe um card com esse texto nessa coluna.');
        card.texto = novo;
        salvar();
        el.querySelector('.card__text').textContent = novo;
    });

    el.addEventListener('dragstart', e => {
        arrastando = el;
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.id);
    });
    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        arrastando = null;
        document.querySelectorAll('.card-container').forEach(c => c.classList.remove('drag-over'));
    });

    return el;
}

function renderizarTudo() {
    Object.values(containers).forEach(c => c.innerHTML = '');
    dados.cards.forEach(card => containers[card.status].appendChild(criarCard(card)));
    atualizarUI();
}

// ---- drag & drop ----

let arrastando = null;

Object.entries(containers).forEach(([status, container]) => {
    container.addEventListener('dragover', e => e.preventDefault());
    container.addEventListener('dragenter', e => {
        e.preventDefault();
        document.querySelectorAll('.card-container').forEach(c => c.classList.remove('drag-over'));
        e.target.closest('.card-container')?.classList.add('drag-over');
    });
    container.addEventListener('dragleave', e => {
        const c = e.target.closest('.card-container');
        if (c && !c.contains(e.relatedTarget)) c.classList.remove('drag-over');
    });
    container.addEventListener('drop', e => {
        e.preventDefault();
        const alvo = e.target.closest('.card-container');
        if (!alvo || !arrastando) return;
        const card = dados.cards.find(c => c.id === parseInt(arrastando.dataset.id));
        const novoStatus = alvo.id;
        if (ORDEM.indexOf(novoStatus) < ORDEM.indexOf(card.status))
            return alert('Não é possível voltar para uma coluna anterior.');
        if (novoStatus === 'doing' && card.status !== 'doing' && porStatus('doing').length >= LIMITE.FAZENDO)
            return alert(`A coluna "Fazendo" já tem ${LIMITE.FAZENDO} cards. Conclua um antes.`);
        card.status = novoStatus;
        salvar();
        alvo.appendChild(arrastando);
        atualizarUI();
        alvo.classList.remove('drag-over');
    });
});

// ---- novo card ----

document.getElementById('btnNovoCard').addEventListener('click', () => {
    if (dados.cards.length >= LIMITE.TOTAL) return alert(`Limite de ${LIMITE.TOTAL} cards atingido.`);
    const texto = prompt('Nome do novo card:')?.trim();
    if (!texto) return;
    if (texto.length < LIMITE.MIN) return alert(`Mínimo de ${LIMITE.MIN} caracteres.`);
    if (porStatus('todo').find(c => c.texto.toLowerCase() === texto.toLowerCase()))
        return alert('Já existe um card com esse texto em "A Fazer".');
    const card = { id: dados.id++, texto, status: 'todo' };
    dados.cards.push(card);
    salvar();
    containers.todo.appendChild(criarCard(card));
    atualizarUI();
});

renderizarTudo();