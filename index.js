const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cors());

//importante o modulo de mysql
var mysql = require('mysql2');

//criando a variável conn que vai ter a referência de conexão
//com o banco de dados
var conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "phpmyadmin",
    port:"3306"
});

//tentando connectar
//a variável con tem a conexão agora
conn.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

app.get('/api/usuario', function (req, res) {
    //cria a string the consulta no baco do tipo select
    let sql = "SELECT u.id, u.nome, u.email, u.senha FROM usuario u";
    //executando o comando sql com a função query
    //nela passamos a string de consulta
    //após a execução ele retorna o function que vai ter a variável err e result
    //se deu algum erro a variável err terá o erro obtivo
    //caso contrário o result terá dos dados do banco 
    conn.query(sql, function (err, result) {
        if (err) res.status(500).json(err);
        res.status(200).json(result);
    });
});

//endpoint para salvar um usuário
app.post('/api/usuario', function (req, res) {
    //captura o json com os dados do usuário
    var usuario = req.body;
    //variável sql par armazenar o comando que vai rodar no banco
    var sql = '';
    //valido se o usuário existe pelo id -> caso exista é um update    
    if (usuario.id) {
        // Atualizar usuário existente
        sql = `UPDATE usuario 
               SET nome = '${usuario.nome}', email = '${usuario.email}', senha = '${usuario.senha}' 
               WHERE id = ${usuario.id}`;
    } else {
        // Criar novo usuário
        sql = `INSERT INTO usuario (nome, email, senha) 
               VALUES ('${usuario.nome}', '${usuario.email}', '${usuario.senha}')`;
    }
    //executa o comando de insert ou update
    conn.query(sql, function (err, result) {
        if (err) throw err;
    });
    res.status(201).json(usuario);
});

app.get('/api/usuario/:id', (req, res) => {
    const { id } = req.params;
    console.log("ID recebido:", id);

    const sql = "SELECT u.id, u.nome, u.email, senha FROM usuario u WHERE u.id = ?";
    conn.query(sql, [id], function (err, result) {
        if (err) {
            console.error("Erro ao buscar usuário:", err);
            return res.status(500).json({ error: "Erro no servidor" });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        console.log("Usuário encontrado:", result[0]);
        res.status(200).json(result[0]);
    });
});

app.delete('/api/usuario/:id', (req, res) => {
    const { id } = req.params;

    let sql = `DELETE FROM usuario WHERE id = ?`;
    conn.query(sql, [id], function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao deletar usuário" });
        }

        console.log(`Usuário com id ${id} deletado.`);
        res.status(200).json({ message: "Usuário deletado com sucesso" });
    });
});

app.listen(PORT, function (err) {
    if (err) console.log(err);
    console.log("Server listening on PORT", PORT);
});