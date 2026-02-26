import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, serverTimestamp, doc, 
    updateDoc, increment, query, orderBy, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let fornecedoresCache = {};

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById("labelUser").innerText = `Olá, ${user.email.split('@')[0]}`;
        const filtro = localStorage.getItem('filtro_assistencia');
        if(filtro) document.getElementById("mainBusca").value = filtro;
        init();
    } else { window.location.href = "index.html"; }
});

async function init() {
    const fSnap = await getDocs(collection(db, "fornecedores"));
    const sel = document.getElementById("selForn");
    sel.innerHTML = '<option value="">Selecione...</option>';
    fSnap.forEach(d => {
        fornecedoresCache[d.id] = d.data().nome;
        sel.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`;
    });
    refresh();
}

async function refresh() {
    const tbody = document.getElementById("corpoTabela");
    const pSnap = await getDocs(query(collection(db, "produtos"), orderBy("nome", "asc")));
    const vSnap = await getDocs(collection(db, "volumes"));
    const vols = vSnap.docs.map(d => ({id: d.id, ...d.data()}));

    tbody.innerHTML = "";

    pSnap.forEach(dp => {
        const p = dp.data();
        const pId = dp.id;
        const nForn = fornecedoresCache[p.fornecedorId] || "---";
        const vDesteProd = vols.filter(v => v.produtoId === pId);
        const qtdTotal = vDesteProd.reduce((acc, curr) => acc + curr.quantidade, 0);

        const tr = document.createElement('tr');
        tr.className = "row-prod";
        tr.dataset.txt = `${p.nome} ${p.codigo} ${nForn}`.toLowerCase();
        tr.innerHTML = `
            <td style="text-align:center; cursor:pointer; color:var(--primary)" onclick="window.toggleVols('${pId}')">▼</td>
            <td>${nForn}</td>
            <td>${p.codigo}</td>
            <td>${p.nome}</td>
            <td style="text-align:center"><strong>${qtdTotal}</strong></td>
            <td style="text-align:right">
                <button class="btn-action" style="background:var(--success)" onclick="window.addVolume('${pId}', '${p.nome}')">+ Volume</button>
                <button class="btn-action" style="background:var(--warning)" onclick="window.editarItem('${pId}', 'produtos', '${p.nome}')">✎</button>
                <button class="btn-action" style="background:var(--danger)" onclick="window.deletar('${pId}', 'produtos')">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);

        vDesteProd.forEach(v => {
            const trV = document.createElement('tr');
            trV.className = `row-vol child-${pId} active`;
            trV.innerHTML = `
                <td></td>
                <td colspan="3" class="indent">↳ ${v.descricao}</td>
                <td style="text-align:center; font-weight:bold;">${v.quantidade}</td>
                <td style="text-align:right">
                    <button class="btn-action" style="background:var(--success)" onclick="window.movimentar('${v.id}', '${v.descricao}', 'Entrada')">▲</button>
                    <button class="btn-action" style="background:var(--danger)" onclick="window.movimentar('${v.id}', '${v.descricao}', 'Saída')">▼</button>
                    <button class="btn-action" style="background:var(--warning); margin-left:15px" onclick="window.editarItem('${v.id}', 'volumes', '${v.descricao}')">✎</button>
                    <button class="btn-action" style="background:var(--gray)" onclick="window.deletar('${v.id}', 'volumes')">✕</button>
                </td>
            `;
            tbody.appendChild(trV);
        });
    });
    filtrar();
}

// --- FUNÇÕES DE EDIÇÃO E MOVIMENTAÇÃO ---

window.editarItem = async (id, tabela, valorAtual) => {
    const novo = prompt("Editar descrição:", valorAtual);
    if (novo && novo !== valorAtual) {
        const campo = tabela === 'produtos' ? 'nome' : 'descricao';
        await updateDoc(doc(db, tabela, id), { [campo]: novo });
        refresh();
    }
};

window.movimentar = async (id, desc, tipo) => {
    const q = prompt(`Quantidade de ${tipo} (${desc}):`, "1");
    if (!q || isNaN(q)) return;
    
    const valor = tipo === 'Entrada' ? parseInt(q) : -parseInt(q);
    await updateDoc(doc(db, "volumes", id), {
        quantidade: increment(valor),
        ultimaMovimentacao: serverTimestamp()
    });
    
    await addDoc(collection(db, "movimentacoes"), {
        produto: desc, tipo, quantidade: parseInt(q),
        usuario: auth.currentUser.email, data: serverTimestamp()
    });
    refresh();
};

window.addVolume = async (pId, pNome) => {
    const d = prompt(`Nome do Volume para ${pNome}: (Ex: Lateral Direita)`);
    if(d) {
        await addDoc(collection(db, "volumes"), {
            produtoId: pId, descricao: d, quantidade: 0, ultimaMovimentacao: serverTimestamp()
        });
        refresh();
    }
};

window.deletar = async (id, tabela) => {
    if(confirm("Deseja realmente excluir? Se for um produto, os volumes não serão apagados automaticamente.")){
        await deleteDoc(doc(db, tabela, id));
        refresh();
    }
};

// --- FILTROS E UI ---

window.toggleVols = (pId) => {
    document.querySelectorAll(`.child-${pId}`).forEach(el => el.classList.toggle('active'));
};

window.filtrar = () => {
    const t = document.getElementById("mainBusca").value.toLowerCase();
    localStorage.setItem('filtro_assistencia', t);
    document.querySelectorAll(".row-prod").forEach(rp => {
        rp.style.display = rp.dataset.txt.includes(t) ? "" : "none";
    });
};

document.getElementById("btnSaveProd").onclick = async () => {
    const n = document.getElementById("newNome").value;
    const c = document.getElementById("newCod").value;
    const f = document.getElementById("selForn").value;
    if(!n || !f) return alert("Preencha Nome e Fornecedor!");
    await addDoc(collection(db, "produtos"), { nome: n, codigo: c || "S/C", fornecedorId: f });
    location.reload();
};

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");
