import { db, auth } from "./firebase-config.js";
import { 
    collection, 
    query, 
    orderBy, 
    getDocs, 
    deleteDoc, 
    doc, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 1. Proteção de Rota: Só permite ver o histórico se estiver logado
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    }
});

// 2. Função Principal: Listar Movimentações
async function listarHistorico() {
    const filtro = document.getElementById("filtro")?.value || "Todos";
    const tabela = document.querySelector("#tabela tbody");
    
    if (!tabela) return;

    tabela.innerHTML = "<tr><td colspan='6'>Carregando movimentações...</td></tr>";

    try {
        // Busca na coleção 'movimentacoes' que o sistema cria automaticamente no giro
        const q = query(collection(db, "movimentacoes"), orderBy("data", "desc"));
        const querySnapshot = await getDocs(q);
        
        tabela.innerHTML = "";

        querySnapshot.forEach((d) => {
            const h = d.data();
            
            // Lógica de Filtro (Entrada / Saída / Todos)
            if (filtro === "Todos" || h.tipo === filtro) {
                const dataFormatada = h.data ? h.data.toDate().toLocaleString('pt-BR') : "Data N/A";
                
                let row = `
                <tr>
                    <td>${dataFormatada}</td>
                    <td>${h.usuario || "Sistema"}</td>
                    <td>${h.produto}</td>
                    <td class="tipo-${h.tipo.replace(/\s/g, '')}" style="font-weight:bold; color: ${h.tipo === 'Saída' ? 'red' : 'green'}">
                        ${h.tipo}
                    </td>
                    <td>${h.quantidade} un</td>
                    <td>
                        <button style="background:#dc3545; color:white; padding:5px; border-radius:4px;" 
                                onclick="excluirMov('${d.id}')">Excluir</button>
                    </td>
                </tr>`;
                tabela.innerHTML += row;
            }
        });

        if (tabela.innerHTML === "") {
            tabela.innerHTML = "<tr><td colspan='6'>Nenhum registro encontrado.</td></tr>";
        }

    } catch (e) {
        console.error("Erro ao listar histórico: ", e);
        tabela.innerHTML = "<tr><td colspan='6' style='color:red'>Erro ao carregar dados. Verifique as permissões do Firestore.</td></tr>";
    }
}

// 3. Função para Excluir Registro (Auditoria)
window.excluirMov = async (id) => {
    if (confirm("Tem certeza que deseja remover este registro do histórico?")) {
        try {
            await deleteDoc(doc(db, "movimentacoes", id));
            alert("Registro removido!");
            listarHistorico();
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
};

// 4. Inicialização
window.onload = listarHistorico;

// Vincula o evento de mudança do Select de filtro
const filtroSelect = document.getElementById("filtro");
if (filtroSelect) {
    filtroSelect.addEventListener("change", listarHistorico);
}
