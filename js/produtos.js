import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, serverTimestamp, doc, 
    updateDoc, increment, query, orderBy, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let idRef = null;
let fornecedoresCache = {};

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById("labelUser").innerText = `Olá, ${user.email.split('@')[0]}`;
        
        // Recuperar filtro persistente
        const filtroSalvo = localStorage.getItem('filtro_produtos');
        if(filtroSalvo) {
            document.getElementById("mainBusca").value = filtroSalvo;
        }

        loadData();
    } else {
        window.location.href = "index.html";
    }
});

async function loadData() {
    // 1. Carregar Fornecedores
    const fSnap = await getDocs(collection(db, "fornecedores"));
    const sel = document.getElementById("selForn");
    sel.innerHTML = '<option value="">Selecione...</option>';
    fSnap.forEach(d => {
        fornecedoresCache[d.id] = d.data().nome;
        sel.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`;
    });

    refreshTable();
}

async function refreshTable() {
    const tbody = document.getElementById("corpoTabela");
    const pSnap = await getDocs(query(collection(db, "produtos"), orderBy("nome", "asc")));
    const vSnap = await getDocs(collection(db, "volumes"));
    const vols = vSnap.docs.map(d => ({id: d.id, ...d.data()}));

    tbody.innerHTML = "";

    pSnap.forEach(dp => {
        const p = dp.data();
        const pId = dp.id;
        const nomeForn = fornecedoresCache[p.fornecedorId] || "Não definido";
        
        // Calcula Qtd Total somando volumes
        const volumesDesteProd = vols.filter(v => v.produtoId === pId);
        const qtdTotal = volumesDesteProd.reduce((acc, curr) => acc + curr.quantidade, 0);

        // Linha Principal (Produto/Fornecedor)
        const tr = document.createElement('tr');
        tr.className = "row-prod";
        tr.dataset.txt = `${p.nome} ${p.codigo} ${nomeForn}`.toLowerCase();
        tr.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON') toggleVolumes(pId);
        };

        tr.innerHTML = `
            <td style="color:var(--primary); font-weight:bold; text-align:center" id="seta-${pId}">▶</td>
            <td style="font-weight:bold">${nomeForn}</td>
            <td>${p.codigo}</td>
            <td>${p.nome}</td>
            <td style="text-align:center"><strong>${qtdTotal}</strong></td>
            <td style="text-align:right">
                <button class="btn-action" style="background:var(--success)" onclick="window.formVol('${pId}', '${p.nome}')">+ Vol</button>
                <button class="btn-action" style="background:var(--danger)" onclick="window.excluirItem('${pId}', 'produtos')">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);

        // Linhas de Volumes (Filhos)
        volumesDesteProd.forEach(v => {
            const trV = document.createElement('tr');
            trV.className = `row-vol child-${pId}`;
            trV.innerHTML = `
                <td></td>
                <td colspan="3" class="indent">↳ ${v.descricao}</td>
                <td style="text-align:center">${v.quantidade}</td>
                <td style="text-align:right">
                    <button class="btn-action" style="background:var(--primary)" onclick="window.giro('${v.id}', '${v.descricao}', 'Entrada')">▲</button>
                    <button class="btn-action" style="background:var(--danger)" onclick="window.giro('${v.id}', '${v.descricao}', 'Saída')">▼</button>
                    <button class="btn-action" style="background:var(--warning)" onclick="window.excluirItem('${v.id}', 'volumes')">🗑</button>
                </td>
            `;
            tbody.appendChild(trV);
        });
    });
    
    // Aplica o filtro após carregar
    filtrar();
}

// --- FUNÇÕES DE INTERAÇÃO ---

window.toggleVolumes = (pId) => {
    const vols = document.querySelectorAll(`.child-${pId}`);
    const seta = document.getElementById(`seta-${pId}`);
    vols.forEach(v => v.classList.toggle('active'));
    seta.innerText = seta.innerText === '▶' ? '▼' : '▶';
};

window.filtrar = () => {
    const t = document.getElementById("mainBusca").value.toLowerCase();
    localStorage.setItem('filtro_produtos', t); // Persistência

    document.querySelectorAll(".row-prod").forEach(rp => {
        const txt = rp.dataset.txt;
        rp.style.display = txt.includes(t) ? "" : "none";
    });
};

// --- CADASTRO ---

document.getElementById("btnSaveProd").onclick = async () => {
    const n = document.getElementById("newNome").value;
    const c = document.getElementById("newCod").value;
    const f = document.getElementById("selForn").value;
    
    if(!n || !f) return alert("Nome e Fornecedor obrigatórios!");

    await addDoc(collection(db, "produtos"), {
        nome: n, codigo: c || "S/C",
        fornecedorId: f, dataCadastro: serverTimestamp()
    });
    
    document.getElementById("newNome").value = "";
    document.getElementById("newCod").value = "";
    refreshTable();
};

// --- MOVIMENTAÇÃO (GIRO) ---

window.giro = (id, desc, tipo) => {
    const qtd = prompt(`Quantidade de ${tipo} para: ${desc}`);
    if(!qtd || isNaN(qtd)) return;

    realizarMovimentacao(id, desc, tipo, parseInt(qtd));
};

async function realizarMovimentacao(id, desc, tipo, qtd) {
    const valor = tipo === 'Saída' ? -qtd : qtd;
    await updateDoc(doc(db, "volumes", id), {
        quantidade: increment(valor),
        ultimaMovimentacao: serverTimestamp()
    });

    await addDoc(collection(db, "movimentacoes"), {
        produto: desc, tipo, quantidade: qtd, 
        usuario: auth.currentUser.email, data: serverTimestamp()
    });
    refreshTable();
}

// --- NOVO VOLUME ---

window.formVol = (pId, pNom) => {
    const d = prompt(`Descrição do volume para ${pNom}:`);
    const q = prompt(`Quantidade inicial:`, "1");

    if(d && q) {
        addDoc(collection(db, "volumes"), {
            produtoId: pId,
            descricao: d,
            quantidade: parseInt(q),
            ultimaMovimentacao: serverTimestamp()
        }).then(() => refreshTable());
    }
};

// --- EXCLUSÃO ---

window.excluirItem = async (id, tabela) => {
    if(confirm("Tem certeza que deseja excluir? Esta ação não pode ser desfeita.")){
        await deleteDoc(doc(db, tabela, id));
        refreshTable();
    }
};

// --- AUXILIARES ---
window.logout = () => signOut(auth).then(() => window.location.href = "index.html");
