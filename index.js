const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const PORT = 8080;

require('dotenv').config();
app.use(express.json());
app.use(cors());

//importante o modulo de mysql
var mysql = require('mysql2');

//criando a variável conn que vai ter a referência de conexão
//com o banco de dados
var conn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
    
});
//tentando connectar
//a variável con tem a conexão agora
conn.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

const generateToken = (id, email) => {
    return jwt.sign({
         id: id, 
         email: email
        }, 
        process.env.JWT_SECRET, {
        expiresIn: '1h'
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};
const bcrypt = require('bcryptjs');

function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    try {
      const decoded = verifyToken(token);
      req.userId = decoded.id;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token inválido' });
    }
  }
 
app.post('/api/login', function (req, res) {
  const { email, senha } = req.body;  
  console.log("req.body",req.body);
  let sql = "SELECT u.id, u.senha FROM usuario u where u.email = email";

  conn.query(sql, [email], function (err, result) {
    console.log("BBBBBBBBBBBB",result[0]);
    if (err) {        
      console.error(err);
      return res.status(500).send("Erro no servidor");
    }

    if (result.length === 0) {
      return res.status(401).send("Email ou senha inválidos");
    }

    //loga com o primeiro usuário cadastrado
    const usuario = result[0];

    bcrypt.compare(senha, usuario.senha, function(err, senhaCorreta) {
        if (err || !senhaCorreta) {
          return res.status(401).send("Email ou senha inválidos");
        }
      
        const token = generateToken(usuario.id, usuario.email);
        res.json({ token });
      });
   
  });
});

// app.get('/api/usuario', function (req, res) {
//     console.log("SADASDA----as-das-da-ds-ad-as-d");
//     let sql = "SELECT id, nome, email, role FROM usuario WHERE id = ?";
//     conn.query(sql, [req.userId], function (err, result) {
//         if (err) return res.status(500).json(err);
//         if (result.length === 0) return res.status(404).send("Usuário não encontrado");

//         res.status(200).json(result[0]);
//     });
// });

app.get('/api/usuario', authenticate, function (req, res) {
    let sql = "SELECT u.id, u.nome, u.email, u.senha FROM usuario u";
    conn.query(sql, function (err, result) {
        if (err) res.status(500).json(err);
        res.status(200).json(result);
    });
});

//endpoint para salvar um usuário
// app.post('/api/usuario', function (req, res) {
//     //captura o json com os dados do usuário
//     var usuario = req.body;
//     //variável sql par armazenar o comando que vai rodar no banco
//     var sql = '';
//     //valido se o usuário existe pelo id -> caso exista é um update    
//     if (usuario.id) {
//         // Atualizar usuário existente
//         sql = `UPDATE usuario 
//                SET nome = '${usuario.nome}', email = '${usuario.email}', senha = '${usuario.senha}' 
//                WHERE id = ${usuario.id}`;
//     } else {
//         // Criar novo usuário
//         sql = `INSERT INTO usuario (nome, email, senha) 
//                VALUES ('${usuario.nome}', '${usuario.email}', '${usuario.senha}')`;
//     }
//     //executa o comando de insert ou update
//     conn.query(sql, function (err, result) {
//         if (err) throw err;
//     });
//     res.status(201).json(usuario);
// });


app.post('/api/usuario', async function (req, res) {
    var usuario = req.body;
    var sql = '';
  
    try {
      // Criptografa a senha antes de salvar
      const senhaCriptografada = await bcrypt.hash(usuario.senha, 10); // 10 = número de rounds
  
      if (usuario.id) {
        // Atualizar usuário existente
        sql = `UPDATE usuario 
               SET nome = ?, email = ?, senha = ? 
               WHERE id = ?`;
  
        conn.query(sql, [usuario.nome, usuario.email, senhaCriptografada, usuario.id], function (err, result) {
          if (err) throw err;
          res.status(200).json({ ...usuario, senha: undefined });
        });
      } else {
        // Criar novo usuário
        sql = `INSERT INTO usuario (nome, email, senha) VALUES (?, ?, ?)`;
  
        conn.query(sql, [usuario.nome, usuario.email, senhaCriptografada], function (err, result) {
          if (err) throw err;
          res.status(201).json({ ...usuario, senha: undefined });
        });
      }
  
    } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao salvar usuário");
    }
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