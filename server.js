const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuração do banco de dados
const dbConfig = {
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexões
const pool = mysql.createPool(dbConfig);

// Teste de conexão
pool.getConnection()
  .then(connection => {
    console.log('Conectado ao banco de dados MySQL!');
    connection.release();
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco de dados:', err);
  });

// Rotas da API

// 1. Clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Cliente ORDER BY nome');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { cpf, nome, telefone, email, senha, observacoes } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO Cliente (cpf, nome, telefone, email, senha, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      [cpf, nome, telefone, email, senha, observacoes]
    );
    res.status(201).json({ id: result.insertId, message: 'Cliente criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cpf, nome, telefone, email, senha, observacoes } = req.body;
    await pool.execute(
      'UPDATE Cliente SET cpf = ?, nome = ?, telefone = ?, email = ?, senha = ?, observacoes = ? WHERE id_cliente = ?',
      [cpf, nome, telefone, email, senha, observacoes, id]
    );
    res.json({ message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM Cliente WHERE id_cliente = ?', [id]);
    res.json({ message: 'Cliente deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 2. Funcionários
app.get('/api/funcionarios', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Funcionario ORDER BY nome');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/funcionarios', async (req, res) => {
  try {
    const { nome, telefone } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO Funcionario (nome, telefone) VALUES (?, ?)',
      [nome, telefone]
    );
    res.status(201).json({ id: result.insertId, message: 'Funcionário criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/funcionarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, telefone, ativo } = req.body;
    await pool.execute(
      'UPDATE Funcionario SET nome = ?, telefone = ?, ativo = ? WHERE id_funcionario = ?',
      [nome, telefone, ativo, id]
    );
    res.json({ message: 'Funcionário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/funcionarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM Funcionario WHERE id_funcionario = ?', [id]);
    res.json({ message: 'Funcionário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 3. Serviços
app.get('/api/servicos', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Servico ORDER BY nome_servico');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/servicos', async (req, res) => {
  try {
    const { nome_servico, descricao, duracao, preco } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO Servico (nome_servico, descricao, duracao, preco) VALUES (?, ?, ?, ?)',
      [nome_servico, descricao, duracao, preco]
    );
    res.status(201).json({ id: result.insertId, message: 'Serviço criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/servicos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_servico, descricao, duracao, preco, ativo } = req.body;
    await pool.execute(
      'UPDATE Servico SET nome_servico = ?, descricao = ?, duracao = ?, preco = ?, ativo = ? WHERE id_servico = ?',
      [nome_servico, descricao, duracao, preco, ativo, id]
    );
    res.json({ message: 'Serviço atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/servicos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM Servico WHERE id_servico = ?', [id]);
    res.json({ message: 'Serviço deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 4. Agendamentos
app.get('/api/agendamentos', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.*, c.nome as cliente_nome, f.nome as funcionario_nome, s.nome_servico
      FROM Agenda a
      JOIN Cliente c ON a.id_cliente = c.id_cliente
      JOIN Funcionario f ON a.id_funcionario = f.id_funcionario
      JOIN Servico s ON a.id_servico = s.id_servico
      ORDER BY a.data DESC, a.hora DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/agendamentos', async (req, res) => {
  try {
    const { id_servico, id_cliente, id_funcionario, data, hora, observacoes } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO Agenda (id_servico, id_cliente, id_funcionario, data, hora, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      [id_servico, id_cliente, id_funcionario, data, hora, observacoes]
    );
    res.status(201).json({ id: result.insertId, message: 'Agendamento criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_servico, id_cliente, id_funcionario, data, hora, status, observacoes } = req.body;
    await pool.execute(
      'UPDATE Agenda SET id_servico = ?, id_cliente = ?, id_funcionario = ?, data = ?, hora = ?, status = ?, observacoes = ? WHERE id_agendamento = ?',
      [id_servico, id_cliente, id_funcionario, data, hora, status, observacoes, id]
    );
    res.json({ message: 'Agendamento atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM Agenda WHERE id_agendamento = ?', [id]);
    res.json({ message: 'Agendamento deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 5. Vendas
app.get('/api/vendas', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.*, c.nome as cliente_nome, f.nome as funcionario_nome, s.nome_servico
      FROM Venda v
      JOIN Cliente c ON v.id_cliente = c.id_cliente
      JOIN Funcionario f ON v.id_funcionario = f.id_funcionario
      JOIN Servico s ON v.id_servico = s.id_servico
      ORDER BY v.data DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/vendas', async (req, res) => {
  try {
    const { id_funcionario, id_cliente, id_servico, id_agendamento, valor, pagamento } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO Venda (id_funcionario, id_cliente, id_servico, id_agendamento, valor, pagamento) VALUES (?, ?, ?, ?, ?, ?)',
      [id_funcionario, id_cliente, id_servico, id_agendamento, valor, pagamento]
    );
    res.status(201).json({ id: result.insertId, message: 'Venda registrada com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 6. Relatórios
app.get('/api/relatorios', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Relatorio ORDER BY data_geracao DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para servir o arquivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
