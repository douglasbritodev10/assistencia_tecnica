import { db, auth } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    increment, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- 1. FUNÇÕES DE INICIALIZAÇÃO E LISTAGEM ---

async function listarProdutos() {
    const corpoTabela = document.querySelector("#tabelaProdutos tbody");
    if (!corpoTabela) return;

    corpoTabela.innerHTML = "<tr><td colspan='4'>Carregando estoque...</td></tr>";

    try {
        // Busca Produtos e Volumes
        const prodSnap = await getDocs(query(collection(db, "produtos"), orderBy("nome", "asc")));
        const volSnap = await getDocs(collection(db, "volumes"));
        
        const listaVolumes = volSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        corpoTabela.innerHTML = "";

        prodSnap.forEach(docP => {
            const p = docP.data();
            const idProd = docP.id;

            // Linha do Produto Principal (Fundo cinza claro)
            corpoTabela.innerHTML += `
                <tr style="background-color: #f0f2f5; font-weight: bold;">
                    <td>[${p.codigo}] ${p.nome}</td>
                    <td>--</td>
                    <td>--</td>
                    <td>
                        <button onclick="window.abrirModalVolume('${idProd}', '${p.nome}')" style="background:#28a745">+ Volume</button>
                    </td>
                </tr>
            `;

            // Filtra e exibe os volumes vinculados a este produto
            const volumesFiltrados = listaVolumes.filter(v => v.produtoId === idProd);

            volumesFiltrados.forEach(v => {
                const dias = calcularDiasParado(v.ultimaMovimentacao);
                const classeStatus = dias > 30 ? 'status-ocioso' : 'status-bom';

                corpoTabela.innerHTML += `
                    <tr class="sub-item">
                        <td class="indent">↳ ${v.descricao}</td>
                        <td><strong>${v.quantidade}</strong> un</td>
                        <td class="${classeStatus}">${dias} dias em estoque</td>
                        <td>
                            <button onclick="window.movimentarVolume('${v.id}', '${v.descricao}', 'Entrada')" style="background:#007bff; padding:5px">▲</button>
                            <button onclick="window.movimentarVolume('${v.id}', '${v.descricao}', 'Saída')" style="background:#dc3545; padding:5px">▼ Saída</button>
                        </td>
                    </tr>
                `;
            });
        });

    } catch (e) {
        console.error("Erro ao listar:", e);
        corpoTabela.innerHTML = "<tr><td colspan='4'>Erro ao carregar dados.</td></tr>";
    }
}

// --- 2. FUNÇÕES DE CADASTRO ---

window.salvarProduto = async () => {
    const nome = document.getElementById("nome").value;
    const cod = document.getElementById("cod").value;
    const fornecedorId = document.getElementById("selectFornecedor").value;

    if (!nome || !fornecedorId) {
        alert("Nome e Fornecedor são obrigatórios!");
        return;
    }

    try {
        await addDoc(collection(db, "produtos"), {
            nome,
            codigo: cod || "S/C",
            fornecedorId,
            dataCadastro: serverTimestamp()
        });
        alert("Produto cadastrado!");
        location.reload();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
};

window.abrirModalVolume = async (idProd, nomeProd) => {
    const desc = prompt(`Qual a descrição do volume para ${nomeProd}? (Ex: Volume 1/2 - Tampo)`);
    const qtd = prompt(`Quantidade inicial em estoque:`);

    if (desc && qtd) {
        await addDoc(collection(db, "volumes"), {
            produtoId: idProd,
            descricao: desc,
            quantidade: parseInt(qtd),
            ultimaMovimentacao: serverTimestamp()
        });
        alert("Volume adicionado ao pulmão!");
        listarProdutos();
    }
};

// --- 3. MOVIMENTAÇÃO DE ESTOQUE (GIRO AUTOMÁTICO) ---

window.movimentarVolume = async (idVol, descVol, tipo) => {
    const qtd = prompt(`Quantidade de ${tipo}:`);
    if (!qtd || isNaN(qtd)) return;

    try {
        const volRef = doc(db, "volumes", idVol);
        const valorAjuste = tipo === "Saída" ? -parseInt(qtd) : parseInt(qtd);

        // Atualiza o estoque no Volume
        await updateDoc(volRef, {
            quantidade: increment(valorAjuste),
            ultimaMovimentacao: serverTimestamp()
        });

        // GRAVA AUTOMATICAMENTE NO HISTÓRICO DE GIRO
        await addDoc(collection(db, "movimentacoes"), {
            produto: descVol,
            tipo: tipo,
            quantidade: parseInt(qtd),
            usuario: auth.currentUser.email,
            data: serverTimestamp()
        });

        alert(`${tipo} realizada com sucesso!`);
        listarProdutos();
    } catch (e) {
        alert("Erro na movimentação: " + e.message);
    }
};

// --- 4. UTILITÁRIOS ---

function calcularDiasParado(timestamp) {
    if (!timestamp) return 0;
    const dataMov = timestamp.toDate();
    const hoje = new Date();
    const diff = Math.floor((hoje - dataMov) / (1000 * 60 * 60 * 24));
    return diff;
}

// Inicialização ao carregar a página
window.onload = () => {
    listarProdutos();
};
