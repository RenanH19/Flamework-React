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
  //console.log("Token criado:",token);
  
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

//rota para validar token
app.get('/api/validate-token', authenticate, (req, res) => {
  res.status(200).json({ valid: true });
});

app.post('/reconnect-db', (req, res) => {
  // Destroi a conexão antiga (se houver)
  if (conn && conn.destroy) {
    conn.destroy();
  }
  // Cria uma nova conexão
  conn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT    
  });
  conn.connect(function (err) {
    if (err) {
      console.error('Erro ao reconectar:', err);
      return res.status(500).json({ message: 'Erro ao reconectar ao banco de dados.' });
    }
    console.log("Reconectado ao banco de dados!");
    res.json({ message: 'Reconectado com sucesso ao banco de dados!' });
  });
});

app.post('/api/login', function (req, res) {
  const { email, senha } = req.body;  
  //console.log("req.body",email);
  const sql = "SELECT u.id, u.nome, u.senha, u.email FROM usuario u WHERE u.email = ?";
  conn.query(sql, [email], function (err, result) {
    if (err) {        
      console.error(err);
      return res.status(500).send("Erro no servidor");
    }
    if (result.length === 0) {
      return res.status(401).send("Email ou senha inválidos");
    }
    const usuario = result[0];
    bcrypt.compare(senha, usuario.senha, function(err, senhaCorreta) {
        if (err || !senhaCorreta) {
          return res.status(401).send("Email ou senha inválidos");
        }      
        const token = generateToken(usuario.id, usuario.email);
        res.json({ token, id: usuario.id, nome: usuario.nome });
      });
   
  });
});

app.get('/api/usuario/', authenticate, function (req, res) {
    let sql = "SELECT u.id, u.nome, u.email, u.senha FROM usuario u";
    conn.query(sql, function (err, result) {
        if (err) res.status(500).json(err);
        res.status(200).json(result);
    });
});

app.get('/api/usuario/:id',authenticate, function(req, res) {
  const { id } = req.params; 
  const sql = "SELECT u.id, u.nome, u.email, senha FROM usuario u WHERE u.id = ?";
  conn.query(sql, [id], function (err, result) {
      if (err) {
          console.error("Erro ao buscar usuário:", err);
          return res.status(500).json({ error: "Erro no servidor" });
      }
      if (result.length === 0) {
          return res.status(404).json({ error: "Usuário não encontrado" });
      }
      res.status(200).json(result[0]);
  });
});

//cadastro
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

// Rota para buscar todos os tópicos
app.get('/api/topicos', authenticate, (req, res) => {
  const sql = "SELECT * FROM topicos ORDER BY id DESC";
  conn.query(sql, function (err, result) {
    if (err) {
      console.error("Erro ao buscar tópicos:", err);
      return res.status(500).json({ error: "Erro ao buscar tópicos" });
    }
    res.status(200).json(result);
  });
});

// Rota para criar um novo tópico
app.post('/api/topicos', (req, res) => {
  const { assunto, texto, autor} = req.body;
  
  const usuarioId = req.headers['userid']; 
  console.log(usuarioId);
 
  if (!usuarioId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }
  if (!assunto || !texto || !autor) {
    return res.status(400).json({ error: "Assunto, texto e autor são obrigatórios" });
  }

  const sql = "INSERT INTO topicos (assunto, texto, autor, usuario_id) VALUES (?, ?, ?, ?)";
  conn.query(sql, [assunto, texto, autor, usuarioId], function (err, result) {
    if (err) {
      console.error("Erro ao criar tópico:", err);
      return res.status(500).json({ error: "Erro ao criar tópico" });
    }

    res.status(201).json({ id: result.insertId, assunto, texto, autor, usuario_id: usuarioId });
  });
});

// Rota para deletar um tópico
app.delete('/api/topicos/:id', authenticate, (req, res) => {
  const { id } = req.params;

  // Primeiro, deletar os comentários relacionados
  const sqlDeleteComentarios = "DELETE FROM comentarios WHERE topico_id = ?";
  conn.query(sqlDeleteComentarios, [id], function (err, result) {
    if (err) {
      console.error("Erro ao deletar comentários do tópico:", err);
      return res.status(500).json({ error: "Erro ao deletar comentários do tópico" });
    }

    // Depois, deletar o tópico
    const sqlDeleteTopico = "DELETE FROM topicos WHERE id = ?";
    conn.query(sqlDeleteTopico, [id], function (err, result) {
      if (err) {
        console.error("Erro ao deletar tópico:", err);
        return res.status(500).json({ error: "Erro ao deletar tópico" });
      }

      return res.status(200).json({ message: "Tópico deletado com sucesso" });
    });
  });
});

// Rota para editar um tópico
app.put('/api/topicos/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { assunto, texto, autor } = req.body;

  const sql = "UPDATE topicos SET assunto = ?, texto = ?, autor = ? WHERE id = ?";
  conn.query(sql, [assunto, texto, autor, id], (err, result) => {
    if (err) {
      console.error("Erro ao atualizar tópico:", err);
      return res.status(500).json({ error: "Erro ao atualizar tópico" });
    }

    res.status(200).json({ id, assunto, texto, autor });
  });
});

//Rota comentários
app.post('/api/comentarios', (req, res) => {
  const { texto, autor, topico_id, usuario_id } = req.body;

  if (!texto || !autor || !topico_id || !usuario_id) {
    return res.status(400).json({ error: "Texto, autor, topico_id e usuario_id são obrigatórios" });
  }

  const sql = "INSERT INTO comentarios (texto, autor, topico_id, usuario_id) VALUES (?, ?, ?, ?)";
  conn.query(sql, [texto, autor, topico_id, usuario_id], function (err, result) {
    if (err) {
      console.error("Erro ao salvar comentário:", err);
      return res.status(500).json({ error: "Erro ao salvar comentário" });
    }

    res.status(201).json({ id: result.insertId, texto, autor, topico_id, usuario_id });
  });
});

app.get('/api/comentarios/:topicoId', (req, res) => {
  const { topicoId } = req.params;

  const sql = "SELECT * FROM comentarios WHERE topico_id = ? ORDER BY id DESC";
  conn.query(sql, [topicoId], function (err, result) {
    if (err) {
      console.error("Erro ao buscar comentários:", err);
      return res.status(500).json({ error: "Erro ao buscar comentários" });
    }

    res.status(200).json(result);
  });
});

app.listen(PORT, function (err) {
  if (err) console.log(err);
  console.log("Server listening on PORT", PORT);
});