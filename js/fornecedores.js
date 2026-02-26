import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

async function checarFornecedores() {
    const colRef = collection(db, "fornecedores");
    const snap = await getDocs(colRef);

    if (snap.empty) {
        // Cria o primeiro fornecedor automaticamente para ativar a coleção
        await addDoc(colRef, {
            nome: "Fornecedor Geral Simonetti",
            cnpj: "00.000.000/0001-00",
            email: "email@dominio.com",
            telefone: "(00) 00000-0000",
            dataCriacao: new Date()
        });
        location.reload();
    }
}

checarFornecedores();
