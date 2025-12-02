const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

// Inicialização do app e middlewares
const app = express();
const PORT = process.env.PORT || 8081;
app.use(cors());
app.use(express.json());
// Servir a pasta pública como raiz (home como página inicial)
app.use(express.static(path.join(__dirname, 'public'), { index: 'home.html' }));
// Também manter o prefixo /public para compatibilidade de links existentes
app.use('/public', express.static(path.join(__dirname, 'public')));
// Servir o módulo de administração (Igdm) sob /igdm
app.use('/igdm', express.static(path.join(__dirname, 'Igdm')));
// Servir assets do módulo do funcionário em /igfc
app.use('/igfc', express.static(path.join(__dirname, 'Igfc')));
// Atalho para /login -> /public/login.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
// Atalho para /funcionario -> Igfc/funcionario.html
app.get('/funcionario', (req, res) => {
  res.sendFile(path.join(__dirname, 'Igfc', 'funcionario.html'));
});

// Configuração do banco e pool de conexões
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
const pool = mysql.createPool(dbConfig);

// Utilitários de endereço
async function findEnderecoByFields({ cep, logradouro, bairro, cidade, complemento }) {
  // Se nenhum campo foi fornecido, não há como buscar
  const anyProvided = cep || logradouro || bairro || cidade || complemento;
  if (!anyProvided) return null;
  const [rows] = await pool.execute(
    'SELECT id_endereco FROM Endereco WHERE (cep <=> ?) AND (logradouro <=> ?) AND (bairro <=> ?) AND (cidade <=> ?) AND (complemento <=> ?) LIMIT 1',
    [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null]
  );
  return (rows && rows.length) ? rows[0].id_endereco : null;
}

async function findOrCreateEndereco({ cep, logradouro, bairro, cidade, complemento }) {
  const matchId = await findEnderecoByFields({ cep, logradouro, bairro, cidade, complemento });
  if (matchId) return matchId;
  const [res] = await pool.execute(
    'INSERT INTO Endereco (cep, logradouro, bairro, cidade, complemento) VALUES (?, ?, ?, ?, ?)',
    [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null]
  );
  return res.insertId;
}

// ===================== Validações de domínio (Diagrama de Classe) =====================
function sanitizeTrim(str) {
  if (typeof str !== 'string') return str;
  const t = str.trim();
  return t.length ? t : null;
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isValidPhone(telefone) {
  if (!telefone) return false;
  // Aceita dígitos, espaços, parênteses e hífens; exige ao menos 8 dígitos
  const digits = telefone.replace(/\D/g, '');
  return digits.length >= 8;
}

function isValidPassword(pw) {
  if (!pw) return false;
  const s = String(pw);
  // Mínimo 8 chars, pelo menos 1 dígito e 1 caractere especial
  if (s.length < 8) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
}

function validateClientePayload(body, { isUpdate = false } = {}) {
  const errors = [];
  const nome = sanitizeTrim(body.nome);
  const email = sanitizeTrim(body.email);
  const telefone = sanitizeTrim(body.telefone);
  const senha = body.senha; // permitido usar trim, mas pode ter espaços internos

  if (!isUpdate) {
    if (!nome) errors.push('nome obrigatório');
    if (!email) errors.push('email obrigatório');
    if (!telefone) errors.push('telefone obrigatório');
    if (!senha) errors.push('senha obrigatória');
  }

  if (nome && nome.length < 2) errors.push('nome muito curto');
  if (email && !isValidEmail(email)) errors.push('email inválido');
  if (telefone && !isValidPhone(telefone)) errors.push('telefone inválido');
  if (senha && !isValidPassword(senha)) errors.push('senha inválida: mínimo 8 caracteres, incluir número e caractere especial');

  // Data de nascimento opcional, se presente validar formato YYYY-MM-DD
  if (body.data_nascimento) {
    const ds = String(body.data_nascimento).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) errors.push('data_nascimento inválida (usar YYYY-MM-DD)');
  }

  return { errors, nome, email, telefone };
}

function validateFuncionarioPayload(body, { isUpdate = false } = {}) {
  const errors = [];
  const nome = sanitizeTrim(body.nome);
  const email = sanitizeTrim(body.email);
  const telefone = sanitizeTrim(body.telefone);
  const senha = body.senha;

  if (!isUpdate) {
    if (!nome) errors.push('nome obrigatório');
    if (!email) errors.push('email obrigatório');
    if (!telefone) errors.push('telefone obrigatório');
  }
  if (nome && nome.length < 2) errors.push('nome muito curto');
  if (email && !isValidEmail(email)) errors.push('email inválido');
  if (telefone && !isValidPhone(telefone)) errors.push('telefone inválido');
  if (senha && !isValidPassword(senha)) errors.push('senha inválida: mínimo 8 caracteres, incluir número e caractere especial');

  return { errors, nome, email, telefone };
}

async function ensureUniqueEmail(email, { excludeUserId = null } = {}) {
  if (!email) return false; // já tratado antes
  const params = [email];
  let sql = 'SELECT id_usuario FROM Usuarios WHERE email = ?';
  if (excludeUserId) {
    sql += ' AND id_usuario <> ?';
    params.push(excludeUserId);
  }
  const [rows] = await pool.execute(sql, params);
  return rows.length === 0;
}

// Utilitário para normalizar data/hora em rotas de agendamento
function parseDateTimeFields(rawDate, rawTime) {
  let date = null;
  let time = null;
  // Data: aceita 'YYYY-MM-DD' ou ISO (pega substring)
  if (rawDate) {
    const s = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      date = s;
    } else if (s.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(s)) {
      date = s.substring(0, 10);
    }
  }
    // ===================== Utilidades de tempo / disponibilidade =====================
    function timeToMinutes(t) {
      if (!t) return 0;
      const parts = t.split(':').map(Number);
      const [h = 0, m = 0, s = 0] = parts;
      return h * 60 + m + Math.floor(s / 60);
    }

    function minutesToTime(total) {
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
    }

    function addMinutesToTime(hhmmss, add) {
      return minutesToTime(timeToMinutes(hhmmss) + add);
    }

    async function computeDurationMinutesForServices(services) {
      if (!Array.isArray(services) || services.length === 0) return 30; // default slot
      let total = 0;
      for (const svc of services) {
        const sid = svc.id_servico || svc.servico_id;
        if (!sid) continue;
        const [rows] = await pool.execute('SELECT duracao FROM Servico WHERE id_servico = ?', [sid]);
        if (rows.length) {
          total += timeToMinutes(rows[0].duracao || '00:30:00');
        } else {
          total += 30; // fallback
        }
      }
      return total || 30;
    }

    function intervalsConflict(startA, durA, startB, durB) {
      // Convert HH:MM:SS to minutes offset within day
      const aStart = timeToMinutes(startA);
      const bStart = timeToMinutes(startB);
      const aEnd = aStart + durA;
      const bEnd = bStart + durB;
      return aStart < bEnd && bStart < aEnd; // overlap
    }

    async function loadAgendamentosFuncionario(dateISO, id_funcionario) {
      const [rows] = await pool.execute(
        'SELECT a.id_agendamento, a.hora_agendamento FROM Agendamento a WHERE a.id_funcionario <=> ? AND DATE(a.data_agendamento) = ? AND a.status NOT IN ("Cancelado","Falta")',
        [id_funcionario, dateISO]
      );
      const result = [];
      for (const r of rows) {
        // calcular duração agregada
        const [svcRows] = await pool.execute(
          'SELECT s.duracao FROM AgendamentoServico asv INNER JOIN Servico s ON asv.id_servico = s.id_servico WHERE asv.id_agendamento = ?',
          [r.id_agendamento]
        );
        let dur = 0;
        for (const s of svcRows) dur += timeToMinutes(s.duracao || '00:30:00');
        if (dur === 0) dur = 30;
        result.push({ start: r.hora_agendamento, duration: dur });
      }
      return result;
    }

    async function funcionarioDisponivel(dateISO, startTime, durationMinutes, id_funcionario) {
      if (!id_funcionario) return false;
      const slots = await loadAgendamentosFuncionario(dateISO, id_funcionario);
      for (const s of slots) {
        if (intervalsConflict(startTime, durationMinutes, s.start, s.duration)) return false;
      }
      return true;
    }

    async function escolherFuncionarioDisponivel(dateISO, startTime, durationMinutes) {
      // Carrega funcionários ativos.
      const [rows] = await pool.execute(
        `SELECT u.id_usuario FROM Usuarios u
         INNER JOIN Logon l ON u.id_usuario = l.id_usuario
         INNER JOIN UsuarioSistema us ON l.id_logon = us.id_logon
         WHERE us.tipo_acesso = 'Funcionario' AND u.ativo = 1 AND us.ativo = 1`
      );
      for (const f of rows) {
        if (await funcionarioDisponivel(dateISO, startTime, durationMinutes, f.id_usuario)) {
          return f.id_usuario;
        }
      }
      return null;
    }

    // ===================== Notificações (stub) =====================
    async function notifyClienteAgendamento(id_cliente, agendamento, tipo = 'confirmacao') {
      try {
        const [rows] = await pool.execute('SELECT nome, email FROM Usuarios WHERE id_usuario = ?', [id_cliente]);
        if (!rows.length) return;
        const cli = rows[0];
        const mensagemBase = tipo === 'confirmacao'
          ? `Seu agendamento #${agendamento.id_agendamento} em ${agendamento.data_agendamento} às ${agendamento.hora_agendamento} foi confirmado.`
          : `Atualização do agendamento #${agendamento.id_agendamento}.`;
        // Placeholder: log. Futuro: integrar nodemailer / push / sms.
        console.log(`Notificação cliente (${cli.email}): ${mensagemBase}`);
      } catch (err) {
        console.warn('Falha ao notificar cliente:', err.message);
      }
    }

  // Hora: aceita 'HH:mm' ou 'HH:mm:ss'
  if (rawTime) {
    const t = String(rawTime);
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) {
      time = t;
    } else if (/^\d{2}:\d{2}$/.test(t)) {
      time = t + ':00';
    }
  }
  return { date, time };
}
// Serviço por ID
app.get('/api/servicos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM Servico WHERE id_servico = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar serviço por ID:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Teste de conexão
pool.getConnection()
  .then(connection => {
    console.log('Conectado ao banco de dados MySQL!');
    connection.release();
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco de dados:', err);
  });

// Middleware de autenticação (verifica JWT no header Authorization)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'sua-chave-secreta', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware para verificar permissões (roles)
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};
// ===== Nova matriz de permissões detalhada =====
// Cliente: somente seus dados e suas compras/agendamentos
// Funcionario: acesso a clientes (visualização), agendamentos, criar vendas, ver própria comissão
// Gerente: gerencia ativação/inativação de clientes/funcionários, vê relatórios e todas as comissões
// Dono: acesso amplo SEM deletar; pode promover/demover funcionário e alterar tipo de acesso
const PERMISSIONS = {
  Cliente: new Set([
    'self:view','self:update','self:vendas','self:agendamentos'
  ]),
  Funcionario: new Set([
    'clientes:view','agendamentos:view','vendas:view','vendas:create','commission:self'
  ]),
  Gerente: new Set([
    'clientes:view','clientes:inactivate','funcionarios:view','funcionarios:inactivate','agendamentos:view','vendas:view','vendas:create','reports:view','commission:all'
  ]),
  Dono: new Set([
    'clientes:view','clientes:inactivate','funcionarios:view','funcionarios:inactivate','funcionarios:promote','funcionarios:demote','funcionarios:role:change',
    'agendamentos:view','vendas:view','vendas:create','reports:view','commission:all','servicos:create','servicos:update','servicos:inactivate'
  ])
};

function hasPermission(role, action){
  return role && PERMISSIONS[role] && PERMISSIONS[role].has(action);
}

function checkPermission(action){
  return (req,res,next)=>{
    const role = req.user && req.user.role;
    if(!hasPermission(role, action)){
      return res.status(403).json({ error:'Permissão negada' });
    }
    next();
  };
}

// ===== Agendamento: estados utilizados =====
// Agendado -> (loja confirma) -> Confirmado -> (início) -> EmAndamento -> (finaliza) -> Realizado
// Se cliente não aparece: EmAndamento por >10min vira Falta
// Cancelado pode ocorrer a partir de Agendado ou Confirmado

// Dono não pode executar deletes físicos
function blockDeleteForDono(req,res,next){
  if(req.user && req.user.role === 'Dono'){
    return res.status(403).json({ error:'Dono não pode deletar' });
  }
  next();
}
app.post('/api/login', async (req, res) => {
  try {
    const { tipo, email, senha } = req.body;

    // Tipo passa a ser opcional: detectamos automaticamente pelo UsuarioSistema
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    let user = null;
    let roles = [];
    let logon = null;
    let legacyCliente = null;
    // Tenta modelo novo (Logon + Usuarios)
    try {
      const [logons] = await pool.execute('SELECT * FROM Logon WHERE email_login = ? OR numero_login = ? LIMIT 1', [email, email]);
      if (logons && logons.length) {
        logon = logons[0];
        const validPassword = await bcrypt.compare(senha, logon.senha_hash || '');
        if (!validPassword) return res.status(401).json({ error: 'Credenciais inválidas' });
        const [usersRows] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [logon.id_usuario]);
        if (!usersRows || !usersRows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        user = usersRows[0];
        const [perms] = await pool.execute('SELECT * FROM UsuarioSistema WHERE id_logon = ?', [logon.id_logon]);
        roles = (perms || []).map(p => String(p.tipo_acesso || ''));
      }
    } catch (e) {
      // Ignora erro estrutural e tenta modo legado
      console.warn('Login: fallback para schema legado Cliente. Motivo:', e.message);
    }

    // Sem tabela Cliente no schema atual: se não achou pelo modelo novo, retorna credenciais inválidas
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Resolve o tipo de acesso:
    // - Se "tipo" for enviado como 'Admin', trata como alias para qualquer papel administrativo (Dono > Gerente > Funcionario)
    // - Se "tipo" corresponder exatamente a um papel, usa-o
    // - Se não houver "tipo", prioriza Cliente se existir; senão, primeiro papel disponível
    let resolvedTipo = null;
    const rolesLower = roles.map(r => String(r).toLowerCase());
    if (tipo && String(tipo).trim()) {
      const wanted = String(tipo).toLowerCase();
      if (wanted === 'admin') {
        if (rolesLower.includes('dono')) resolvedTipo = roles[rolesLower.indexOf('dono')];
        else if (rolesLower.includes('gerente')) resolvedTipo = roles[rolesLower.indexOf('gerente')];
        else if (rolesLower.includes('funcionario')) resolvedTipo = roles[rolesLower.indexOf('funcionario')];
        else return res.status(403).json({ error: 'Usuário sem acesso administrativo' });
      } else {
        const idx = rolesLower.indexOf(wanted);
        if (idx === -1) return res.status(403).json({ error: 'Tipo de usuário incorreto' });
        resolvedTipo = roles[idx];
      }
    } else {
      const hasCliente = rolesLower.includes('cliente');
      resolvedTipo = hasCliente ? roles[rolesLower.indexOf('cliente')] : (roles[0] || 'Cliente');
    }

    const token = jwt.sign({ id: user.id_usuario, nome: user.nome, role: resolvedTipo }, process.env.JWT_SECRET || 'sua-chave-secreta', { expiresIn: '24h' });

    res.json({ token, user: { id: user.id_usuario, nome: user.nome, email: user.email, role: resolvedTipo } });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Rotas da API

// 1. Clientes
// Rotas de CLIENTES 
app.get('/api/clientes', async (req, res) => {
  const primaryQuery = `
      SELECT 
        u.id_usuario,
        u.nome,
        u.email,
        u.telefone,
        u.data_nascimento,
        u.ativo,
        u.data_cadastro,
        u.id_endereco,
        e.cep AS endereco_cep,
        e.logradouro AS endereco_logradouro,
        e.bairro AS endereco_bairro,
        e.cidade AS endereco_cidade,
        e.complemento AS endereco_complemento,
        us.tipo_acesso
      FROM Usuarios u
      LEFT JOIN Endereco e ON u.id_endereco = e.id_endereco
      INNER JOIN Logon l ON u.id_usuario = l.id_usuario
      INNER JOIN UsuarioSistema us ON l.id_logon = us.id_logon
      WHERE us.tipo_acesso = 'Cliente'
      ORDER BY u.nome
    `;

  try {
    const [rows] = await pool.execute(primaryQuery);
    return res.json(rows);
  } catch (error) {
    console.warn('Primary clientes query failed:', error.message);
    try {
      const [rows] = await pool.execute(`
        SELECT u.id_usuario, u.nome, u.email, u.telefone, u.data_nascimento, u.ativo, u.data_cadastro, u.id_endereco,
          e.cep AS endereco_cep, e.bairro AS endereco_bairro, e.cidade AS endereco_cidade,
          us.tipo_acesso
        FROM Usuarios u
        LEFT JOIN Endereco e ON u.id_endereco = e.id_endereco
        JOIN Logon l ON u.id_usuario = l.id_usuario
        JOIN UsuarioSistema us ON l.id_logon = us.id_logon
        WHERE us.tipo_acesso = 'Cliente'
        ORDER BY u.nome
      `);
      return res.json(rows);
    } catch (err2) {
      console.error('Fallback clientes query also failed:', err2);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Criar novo cliente
app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, telefone, email, senha, data_nascimento, id_endereco, cep, logradouro, bairro, cidade, complemento } = req.body;

    // Validação de acordo com diagrama
    const { errors } = validateClientePayload(req.body, { isUpdate: false });
    if (errors.length) return res.status(400).json({ error: 'Payload inválido', detalhes: errors });

    const emailOk = await ensureUniqueEmail(email);
    if (!emailOk) return res.status(409).json({ error: 'Email já cadastrado' });

    // Se foram informados dados de endereço (ou cep), tenta reutilizar um Endereco existente
    let idEnderecoToUse = id_endereco || null;
    if (!idEnderecoToUse && (cep || logradouro || bairro || cidade || complemento)) {
      idEnderecoToUse = await findOrCreateEndereco({ cep, logradouro, bairro, cidade, complemento });
    }

    // Insere o usuário na tabela Usuarios (id_endereco pode ser null para clientes)
    const [usuarioResult] = await pool.execute(
      'INSERT INTO Usuarios (nome, email, telefone, data_nascimento, id_endereco) VALUES (?, ?, ?, ?, ?)',
      [nome, email, telefone, data_nascimento || null, idEnderecoToUse]
    );
    const id_usuario = usuarioResult.insertId;

    // Cria o registro de Logon (autenticação)
    const senhaHash = senha ? await bcrypt.hash(senha, 10) : null;
    const [logonResult] = await pool.execute(
      'INSERT INTO Logon (id_usuario, email_login, senha_hash) VALUES (?, ?, ?)',
      [id_usuario, email, senhaHash]
    );
    const id_logon = logonResult.insertId;

    // Define o tipo de acesso no UsuarioSistema (usa id_logon)
    await pool.execute(
      'INSERT INTO UsuarioSistema (id_logon, tipo_acesso) VALUES (?, ?)',
      [id_logon, 'Cliente']
    );

    res.status(201).json({ id_usuario, message: 'Cliente cradastrado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alias de registro público: aceita o mesmo JSON do POST /api/clientes
// Frontend (login.html) envia: { nome, email, senha, telefone, cpf }
// Campos extras (ex.: cpf) são ignorados se não existirem no schema.
app.post('/api/register', async (req, res) => {
  try {
    const { nome, telefone, email, senha, data_nascimento, id_endereco, cep, logradouro, bairro, cidade, complemento } = req.body;

    const { errors } = validateClientePayload(req.body, { isUpdate: false });
    if (errors.length) return res.status(400).json({ error: 'Payload inválido', detalhes: errors });
    const emailOk = await ensureUniqueEmail(email);
    if (!emailOk) return res.status(409).json({ error: 'Email já cadastrado' });

    // Reutiliza a mesma lógica de criação de cliente
    let idEnderecoToUse = id_endereco || null;
    if (!idEnderecoToUse && (cep || logradouro || bairro || cidade || complemento)) {
      // Tenta encontrar endereço existente por CEP + logradouro + cidade + bairro (quando informados)
      const [endRows] = await pool.execute(
        'SELECT id_endereco FROM Endereco WHERE (cep <=> ?) AND (logradouro <=> ?) AND (bairro <=> ?) AND (cidade <=> ?) AND (complemento <=> ?) LIMIT 1',
        [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null]
      );
      if (endRows && endRows.length) {
        idEnderecoToUse = endRows[0].id_endereco;
      } else {
        const [insEnd] = await pool.execute(
          'INSERT INTO Endereco (cep, logradouro, bairro, cidade, complemento) VALUES (?, ?, ?, ?, ?)',
          [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null]
        );
        idEnderecoToUse = insEnd.insertId;
      }
    }

    // Cria usuário (endereço pode ser null)
    const [usuarioResult] = await pool.execute(
      'INSERT INTO Usuarios (nome, email, telefone, data_nascimento, id_endereco) VALUES (?, ?, ?, ?, ?)',
      [nome, email, telefone, data_nascimento || null, idEnderecoToUse]
    );
    const id_usuario = usuarioResult.insertId;

    // Cria logon com hash da senha
    const senhaHash = senha ? await bcrypt.hash(senha, 10) : null;
    const [logonResult] = await pool.execute(
      'INSERT INTO Logon (id_usuario, email_login, senha_hash) VALUES (?, ?, ?)',
      [id_usuario, email, senhaHash]
    );
    const id_logon = logonResult.insertId;

    // Vincula como Cliente no sistema
    await pool.execute(
      'INSERT INTO UsuarioSistema (id_logon, tipo_acesso) VALUES (?, ?)',
      [id_logon, 'Cliente']
    );

    res.status(201).json({ id_usuario, message: 'Cliente registrado com sucesso' });
  } catch (error) {
    console.error('Erro no registro de cliente (/api/register):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Atualizar cliente
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, telefone, email, senha, data_nascimento, id_endereco, cep, logradouro, bairro, cidade, complemento } = req.body;

    const { errors } = validateClientePayload(req.body, { isUpdate: true });
    if (errors.length) return res.status(400).json({ error: 'Payload inválido', detalhes: errors });
    if (email) {
      const emailOk = await ensureUniqueEmail(email, { excludeUserId: id });
      if (!emailOk) return res.status(409).json({ error: 'Email já cadastrado por outro usuário' });
    }

    // Gerenciar endereço: se foram enviados dados de endereço, proceder com dedupe e atualização segura
    let idEnderecoToUse = id_endereco || null;
    const addressProvided = (cep || logradouro || bairro || cidade || complemento);

    if (addressProvided) {
      if (!idEnderecoToUse) {
        idEnderecoToUse = await findOrCreateEndereco({ cep, logradouro, bairro, cidade, complemento });
      } else {
        const [countRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM Usuarios WHERE id_endereco = ?', [idEnderecoToUse]);
        const usedBy = countRows && countRows.length ? countRows[0].cnt : 0;
        if (usedBy <= 1) {
          await pool.execute(
            'UPDATE Endereco SET cep = COALESCE(?, cep), logradouro = COALESCE(?, logradouro), bairro = COALESCE(?, bairro), cidade = COALESCE(?, cidade), complemento = COALESCE(?, complemento) WHERE id_endereco = ?',
            [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null, idEnderecoToUse]
          );
        } else {
          const matchId = await findEnderecoByFields({ cep, logradouro, bairro, cidade, complemento });
          if (matchId) {
            idEnderecoToUse = matchId;
          } else {
            const [endResult] = await pool.execute(
              'INSERT INTO Endereco (cep, logradouro, bairro, cidade, complemento) VALUES (?, ?, ?, ?, ?)',
              [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null]
            );
            idEnderecoToUse = endResult.insertId;
          }
        }
      }
    }

    // Atualiza informações básicas
    await pool.execute(
      'UPDATE Usuarios SET nome = ?, telefone = ?, email = ?, data_nascimento = ?, id_endereco = ? WHERE id_usuario = ?',
      [nome, telefone, email, data_nascimento || null, idEnderecoToUse || null, id]
    );

    // Atualiza senha (opcional)
    if (senha) {
      // Hash da nova senha e atualiza na coluna correta
      const senhaHash = await bcrypt.hash(senha, 10);
      await pool.execute(
        'UPDATE Logon SET senha_hash = ? WHERE id_usuario = ?',
        [senhaHash, id]
      );
    }

    res.json({ message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Inativar cliente (marca ativo = 0)
app.post('/api/clientes/:id/inativar', async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o usuário existe
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualiza o status do usuário para inativo
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);

    // Inativa as permissões em UsuarioSistema vinculadas a este usuário (via Logon)
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length > 0) {
      const ids = logons.map(l => l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    // Opcional: limpar token do Logon
    await pool.execute('UPDATE Logon SET token = NULL WHERE id_usuario = ?', [id]);

    res.json({ message: 'Usuário inativado com sucesso' });
  } catch (error) {
    console.error('Erro ao inativar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Ativar cliente (marca ativo = 1)
app.post('/api/clientes/:id/ativar', async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o usuário existe
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualiza o status do usuário para ativo
    await pool.execute('UPDATE Usuarios SET ativo = 1 WHERE id_usuario = ?', [id]);

    // Reativa as permissões em UsuarioSistema vinculadas a este usuário (via Logon)
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length > 0) {
      const ids = logons.map(l => l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 1 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }

    res.json({ message: 'Usuário ativado com sucesso' });
  } catch (error) {
    console.error('Erro ao ativar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar cliente (exclusão física) — permitido apenas se não houver vendas associadas
// Substitui exclusão física por inativação de cliente
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);
    // Inativa também UsuarioSistema vinculado
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Cliente inativado (soft delete)' });
  } catch (error) {
    console.error('Erro ao inativar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Force-delete cliente (apenas Admin) — remove registros associados antes de excluir o usuário
// Force now also soft deletes (mantém histórico)
app.delete('/api/clientes/:id/force', authenticateToken, checkPermission('clientes:inactivate'), blockDeleteForDono, async (req, res) => {
  try {
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Cliente inativado (force soft delete)' });
  } catch (error) {
    console.error('Erro ao inativar cliente (force):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Buscar cliente por ID
app.get('/api/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const primaryQuery = `
      SELECT 
        u.id_usuario,
        u.nome,
        u.email,
        u.telefone,
        u.data_nascimento,
        u.ativo,
        u.data_cadastro,
        u.id_endereco,
        e.cep AS cep,
        e.logradouro AS logradouro,
        e.bairro AS bairro,
        e.cidade AS cidade,
        e.complemento AS complemento,
        COALESCE(us.tipo_acesso, 'Cliente') AS tipo_acesso
      FROM Usuarios u
      LEFT JOIN Endereco e ON u.id_endereco = e.id_endereco
      LEFT JOIN Logon l ON u.id_usuario = l.id_usuario
      LEFT JOIN UsuarioSistema us ON l.id_logon = us.id_logon
      WHERE u.id_usuario = ?
    `;

  try {
    const [rows] = await pool.execute(primaryQuery, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json(rows[0]);
  } catch (error) {
    console.warn('Primary cliente by id query failed, attempting fallback:', error.message);
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      try {
        const [rows] = await pool.execute(`
          SELECT 
            u.id_usuario,
            u.nome,
            u.email,
            u.telefone,
            'cliente' AS tipo_acesso
          FROM Usuarios u
          WHERE u.id_usuario = ?
        `, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
        return res.json(rows[0]);
      } catch (err2) {
        console.error('Fallback cliente by id query also failed:', err2);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    console.error('Erro ao buscar cliente por ID:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 2. Funcionários (no novo schema, funcionários são Users com tipo_acesso = 'Funcionario')
app.get('/api/funcionarios', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.id_usuario, u.nome, u.email, u.telefone, u.data_nascimento, u.ativo, u.data_cadastro, u.id_endereco,
        e.bairro AS endereco_bairro, e.cidade AS endereco_cidade, us.tipo_acesso
      FROM Usuarios u
      LEFT JOIN Endereco e ON u.id_endereco = e.id_endereco
      LEFT JOIN Logon l ON u.id_usuario = l.id_usuario
      LEFT JOIN UsuarioSistema us ON l.id_logon = us.id_logon
      WHERE us.tipo_acesso = 'Funcionario'
      ORDER BY u.nome
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/funcionarios', async (req, res) => {
  try {
    const { nome, telefone, email, senha, permissoes, data_nascimento, id_endereco, ativo, cep, logradouro, bairro, cidade, complemento } = req.body; // permissoes: {pode_agendar, pode_vender,...}

    const { errors } = validateFuncionarioPayload(req.body, { isUpdate: false });
    if (errors.length) return res.status(400).json({ error: 'Payload inválido', detalhes: errors });
    const emailOk = await ensureUniqueEmail(email);
    if (!emailOk) return res.status(409).json({ error: 'Email já cadastrado' });

    // Gerenciar endereço: para funcionários endereço é obrigatório
    let idEnderecoToUse = id_endereco || null;
    if (!idEnderecoToUse && (cep || logradouro || bairro || cidade || complemento)) {
      idEnderecoToUse = await findOrCreateEndereco({ cep, logradouro, bairro, cidade, complemento });
    }
    if (!idEnderecoToUse) {
      return res.status(400).json({ error: 'Endereço obrigatório para cadastro de funcionários' });
    }

    // normalizar valor de ativo (form pode enviar '1'/'0' como string)
    const ativoFlag = (ativo === false || ativo === 0 || ativo === '0') ? 0 : 1;
    const [usuarioResult] = await pool.execute(
      'INSERT INTO Usuarios (nome, email, telefone, data_nascimento, id_endereco, ativo) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, email, telefone, data_nascimento || null, idEnderecoToUse, ativoFlag]
    );
    const id_usuario = usuarioResult.insertId;

    // Hash da senha antes de armazenar
    const senhaHash = senha ? await bcrypt.hash(senha, 10) : null;
    const [logonResult] = await pool.execute(
      'INSERT INTO Logon (id_usuario, email_login, senha_hash) VALUES (?, ?, ?)',
      [id_usuario, email, senhaHash]
    );
    const id_logon = logonResult.insertId;

    // Inserir permissões padrão/fornecidas
    const { pode_agendar = true, pode_vender = false, pode_ver_relatorios = false, pode_gerenciar = false } = permissoes || {};
    await pool.execute(
      'INSERT INTO UsuarioSistema (id_logon, tipo_acesso, pode_agendar, pode_vender, pode_ver_relatorios, pode_gerenciar) VALUES (?, ?, ?, ?, ?, ?)',
      [id_logon, 'Funcionario', pode_agendar, pode_vender, pode_ver_relatorios, pode_gerenciar]
    );

    res.status(201).json({ id_usuario, message: 'Funcionário criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/funcionarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, telefone, email, senha, permissoes, data_nascimento, id_endereco, ativo, cep, logradouro, bairro, cidade, complemento } = req.body;

    const { errors } = validateFuncionarioPayload(req.body, { isUpdate: true });
    if (errors.length) return res.status(400).json({ error: 'Payload inválido', detalhes: errors });
    if (email) {
      const emailOk = await ensureUniqueEmail(email, { excludeUserId: id });
      if (!emailOk) return res.status(409).json({ error: 'Email já cadastrado por outro usuário' });
    }

    // normalizar ativo para update (se não fornecido, mantém o valor atual)
    let ativoParam = null;
    if (typeof ativo !== 'undefined') {
      ativoParam = (ativo === false || ativo === 0 || ativo === '0') ? 0 : 1;
    }
    // Gerenciar endereço: se foram enviados dados de endereço, proceder com dedupe e atualização segura
    let idEnderecoToUse = id_endereco || null;
    const addressProvided = (cep || logradouro || bairro || cidade || complemento);

    if (addressProvided) {
      // Se não há id_endereco, tente reutilizar ou criar
      if (!idEnderecoToUse) {
        idEnderecoToUse = await findOrCreateEndereco({ cep, logradouro, bairro, cidade, complemento });
      } else {
        // id_endereco informado: verificar se este endereco está sendo compartilhado
        const [countRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM Usuarios WHERE id_endereco = ?', [idEnderecoToUse]);
        const usedBy = countRows && countRows.length ? countRows[0].cnt : 0;
        if (usedBy <= 1) {
          // seguro atualizar o registro existente
          await pool.execute(
            'UPDATE Endereco SET cep = COALESCE(?, cep), logradouro = COALESCE(?, logradouro), bairro = COALESCE(?, bairro), cidade = COALESCE(?, cidade), complemento = COALESCE(?, complemento) WHERE id_endereco = ?',
            [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null, idEnderecoToUse]
          );
        } else {
          // compartilhado: procurar endereco idêntico ou criar novo e usar esse novo id
          const matchId = await findEnderecoByFields({ cep, logradouro, bairro, cidade, complemento });
          if (matchId) {
            idEnderecoToUse = matchId;
          } else {
            const [endResult] = await pool.execute(
              'INSERT INTO Endereco (cep, logradouro, bairro, cidade, complemento) VALUES (?, ?, ?, ?, ?)',
              [cep || null, logradouro || null, bairro || null, cidade || null, complemento || null]
            );
            idEnderecoToUse = endResult.insertId;
          }
        }
      }
    }

    await pool.execute(
      'UPDATE Usuarios SET nome = ?, telefone = ?, email = ?, data_nascimento = ?, id_endereco = ?, ativo = COALESCE(?, ativo) WHERE id_usuario = ?',
      [nome, telefone, email, data_nascimento || null, idEnderecoToUse || null, ativoParam, id]
    );

    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      await pool.execute('UPDATE Logon SET senha_hash = ? WHERE id_usuario = ?', [senhaHash, id]);
    }

    if (permissoes) {
      // Atualiza UsuarioSistema correspondendo ao id_logon do usuário
      const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
      if (logons && logons.length > 0) {
        const id_logon = logons[0].id_logon;
        const { pode_agendar, pode_vender, pode_ver_relatorios, pode_gerenciar, ativo } = permissoes;
        await pool.execute(
          'UPDATE UsuarioSistema SET pode_agendar = COALESCE(?, pode_agendar), pode_vender = COALESCE(?, pode_vender), pode_ver_relatorios = COALESCE(?, pode_ver_relatorios), pode_gerenciar = COALESCE(?, pode_gerenciar), ativo = COALESCE(?, ativo) WHERE id_logon = ?',
          [pode_agendar, pode_vender, pode_ver_relatorios, pode_gerenciar, ativo, id_logon]
        );
      }
    }

    res.json({ message: 'Funcionário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/funcionarios/:id', authenticateToken, checkPermission('funcionarios:inactivate'), blockDeleteForDono, async (req, res) => {
  try {
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Funcionário inativado (soft delete)' });
  } catch (error) {
    console.error('Erro ao inativar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Funcionário por ID
app.get('/api/funcionarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(`
      SELECT u.id_usuario, u.nome, u.email, u.telefone, u.data_nascimento, u.data_cadastro, u.id_endereco, u.ativo,
        e.cep AS cep, e.logradouro AS logradouro, e.bairro AS bairro, e.cidade AS cidade, e.complemento AS complemento,
        us.*
      FROM Usuarios u
      LEFT JOIN Endereco e ON u.id_endereco = e.id_endereco
      LEFT JOIN Logon l ON u.id_usuario = l.id_usuario
      LEFT JOIN UsuarioSistema us ON l.id_logon = us.id_logon
      WHERE u.id_usuario = ?
    `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar funcionário por ID:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inativar funcionário (ativo=0 em Usuarios e UsuarioSistema)
app.post('/api/funcionarios/:id/inativar', authenticateToken, checkPermission('funcionarios:inactivate'), async (req, res) => {
  try {
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length > 0) {
      const ids = logons.map(l => l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    await pool.execute('UPDATE Logon SET token = NULL WHERE id_usuario = ?', [id]);
    res.json({ message: 'Funcionário inativado com sucesso' });
  } catch (error) {
    console.error('Erro ao inativar funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Ativar funcionário (ativo=1 em Usuarios e UsuarioSistema)
app.post('/api/funcionarios/:id/ativar', authenticateToken, checkPermission('funcionarios:inactivate'), async (req, res) => {
  try {
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 1 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons && logons.length > 0) {
      const ids = logons.map(l => l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 1 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Funcionário ativado com sucesso' });
  } catch (error) {
    console.error('Erro ao ativar funcionário:', error);
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
    const [rows] = await pool.execute('SELECT * FROM Servico WHERE id_servico = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Serviço não encontrado' });
    await pool.execute('UPDATE Servico SET ativo = 0 WHERE id_servico = ?', [id]);
    res.json({ message: 'Serviço inativado (soft delete)' });
  } catch (error) {
    console.error('Erro ao inativar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inativar/Ativar Serviço
app.post('/api/servicos/:id/inativar', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE Servico SET ativo = 0 WHERE id_servico = ?', [id]);
    res.json({ message: 'Serviço inativado com sucesso' });
  } catch (error) {
    console.error('Erro ao inativar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Reativar serviço
app.post('/api/servicos/:id/reativar', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE Servico SET ativo = 1 WHERE id_servico = ?', [id]);
    res.json({ message: 'Serviço reativado com sucesso' });
  } catch (error) {
    console.error('Erro ao reativar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inativar cliente
app.post('/api/clientes/:id/inativar', authenticateToken, async (req, res) => {
  try {
    if (!['Gerente','Dono'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Cliente inativado' });
  } catch (e) {
    console.error('Erro ao inativar cliente:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Reativar cliente
app.post('/api/clientes/:id/reativar', authenticateToken, async (req, res) => {
  try {
    if (!['Gerente','Dono'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 1 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 1 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Cliente reativado' });
  } catch (e) {
    console.error('Erro ao reativar cliente:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inativar funcionário
app.post('/api/funcionarios/:id/inativar', authenticateToken, async (req, res) => {
  try {
    if (!['Gerente','Dono'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 0 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 0 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Funcionário inativado' });
  } catch (e) {
    console.error('Erro ao inativar funcionário:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Reativar funcionário
app.post('/api/funcionarios/:id/reativar', authenticateToken, async (req, res) => {
  try {
    if (!['Gerente','Dono'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
    const { id } = req.params;
    const [usuario] = await pool.execute('SELECT * FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!usuario.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    await pool.execute('UPDATE Usuarios SET ativo = 1 WHERE id_usuario = ?', [id]);
    const [logons] = await pool.execute('SELECT id_logon FROM Logon WHERE id_usuario = ?', [id]);
    if (logons.length) {
      const ids = logons.map(l=>l.id_logon);
      await pool.execute(`UPDATE UsuarioSistema SET ativo = 1 WHERE id_logon IN (${ids.map(()=>'?').join(',')})`, ids);
    }
    res.json({ message: 'Funcionário reativado' });
  } catch (e) {
    console.error('Erro ao reativar funcionário:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cancelar agendamento (sem apagar)
app.post('/api/agendamentos/:id/cancelar', authenticateToken, async (req, res) => {
  try {
    if (!['Gerente','Dono','Funcionario'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT status FROM Agendamento WHERE id_agendamento = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    await pool.execute('UPDATE Agendamento SET status = ? WHERE id_agendamento = ?', ['Cancelado', id]);
    res.json({ message: 'Agendamento cancelado' });
  } catch (e) {
    console.error('Erro ao cancelar agendamento:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/servicos/:id/ativar', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE Servico SET ativo = 1 WHERE id_servico = ?', [id]);
    res.json({ message: 'Serviço ativado com sucesso' });
  } catch (error) {
    console.error('Erro ao ativar serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 4. Agendamentos (lista com agregação de serviços)
app.get('/api/agendamentos', async (req, res) => {
  try {
    let whereClause = '';
    const params = [];

    // Filtros: cliente_ids, funcionario_ids, servico_ids, status, start_date/end_date
    const clienteIdsParam = req.query.cliente_ids;
    if (clienteIdsParam) {
      const ids = String(clienteIdsParam)
        .split(',')
        .map(s => Number(s))
        .filter(n => !isNaN(n));
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const clause = ` a.id_cliente IN (${placeholders}) `;
        whereClause = whereClause ? `${whereClause} AND ${clause}` : `WHERE ${clause}`;
        params.push(...ids);
      }
    }

    const funcionarioIdsParam = req.query.funcionario_ids;
    if (funcionarioIdsParam) {
      const ids = String(funcionarioIdsParam)
        .split(',')
        .map(s => Number(s))
        .filter(n => !isNaN(n));
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const clause = ` a.id_funcionario IN (${placeholders}) `;
        whereClause = whereClause ? `${whereClause} AND ${clause}` : `WHERE ${clause}`;
        params.push(...ids);
      }
    }

    const servicoIdsParam = req.query.servico_ids;
    if (servicoIdsParam) {
      const ids = String(servicoIdsParam)
        .split(',')
        .map(s => Number(s))
        .filter(n => !isNaN(n));
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const clause = ` asv.id_servico IN (${placeholders}) `;
        whereClause = whereClause ? `${whereClause} AND ${clause}` : `WHERE ${clause}`;
        params.push(...ids);
      }
    }

    const statusParam = req.query.status;
    if (statusParam) {
      const list = String(statusParam).split(',').map(s => String(s));
      if (list.length) {
        const placeholders = list.map(() => '?').join(',');
        const clause = ` a.status IN (${placeholders}) `;
        whereClause = whereClause ? `${whereClause} AND ${clause}` : `WHERE ${clause}`;
        params.push(...list);
      }
    }

    const { start_date, end_date } = req.query;
    if (start_date && end_date) {
      const clause = ' DATE(a.data_agendamento) BETWEEN ? AND ? ';
      whereClause = whereClause ? `${whereClause} AND ${clause}` : `WHERE ${clause}`;
      params.push(start_date, end_date);
    }

    const sql = `
      SELECT
        a.id_agendamento,
        a.status,
        a.observacoes,
        DATE_FORMAT(a.data_agendamento, '%Y-%m-%d') AS data,
        TIME_FORMAT(a.hora_agendamento, '%H:%i:%s') AS hora,
        a.id_cliente,
        a.id_funcionario,
        uc.nome AS cliente_nome,
        uf.nome AS funcionario_nome,
        GROUP_CONCAT(DISTINCT s.nome_servico SEPARATOR ', ') AS servicos,
        SEC_TO_TIME(IFNULL(SUM(TIME_TO_SEC(s.duracao)),0)) AS duracao_total,
        TIME_FORMAT(ADDTIME(a.hora_agendamento, SEC_TO_TIME(IFNULL(SUM(TIME_TO_SEC(s.duracao)),0))), '%H:%i:%s') AS hora_fim
      FROM Agendamento a
      LEFT JOIN Usuarios uc ON a.id_cliente = uc.id_usuario
      LEFT JOIN Usuarios uf ON a.id_funcionario = uf.id_usuario
      LEFT JOIN AgendamentoServico asv ON asv.id_agendamento = a.id_agendamento
      LEFT JOIN Servico s ON asv.id_servico = s.id_servico
      ${whereClause}
      GROUP BY a.id_agendamento
      ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC
    `;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r => ({
      ...r,
      servicos: r.servicos ? String(r.servicos) : ''
    })));
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/agendamentos', async (req, res) => {
  let connection;
  try {
    console.log('POST /api/agendamentos payload:', JSON.stringify(req.body));
    // aceita tanto payload antigo quanto novo
    // novo formato: { cliente_id / id_cliente, funcionario_id / id_funcionario, data_agendamento (ou date ISO), hora_agendamento (ou time), services: [{id_servico, quantidade, preco_unitario, observacoes}], payments: [{id_forma, metodo, valor, referencia}] }
    const rawDate = (typeof req.body.data_agendamento !== 'undefined') ? req.body.data_agendamento : (req.body.data || req.body.date);
    const rawTime = (typeof req.body.hora_agendamento !== 'undefined') ? req.body.hora_agendamento : (req.body.hora || req.body.time);
    const dt = parseDateTimeFields(rawDate, rawTime);

    const id_cliente = req.body.id_cliente || req.body.cliente_id || null;
    const id_funcionario = req.body.id_funcionario || req.body.funcionario_id || null;
    const observacoes = req.body.observacoes || null;

    const services = Array.isArray(req.body.services) ? req.body.services : (req.body.id_servico ? [{ id_servico: req.body.id_servico, quantidade: req.body.quantidade || 1, preco_unitario: req.body.preco || null }] : []);
    const payments = Array.isArray(req.body.payments) ? req.body.payments : (req.body.payments ? req.body.payments : []);

    if (!id_cliente || !dt.date || !dt.time) {
      console.warn('Agendamento inválido:', { id_cliente, rawDate, rawTime, dt });
      return res.status(400).json({ error: 'Campos obrigatórios ausentes: id_cliente, data_agendamento e hora_agendamento' });
    }

    // calcular duração total dos serviços para bloqueio de agenda
    const durationMinutes = await computeDurationMinutesForServices(services);

    // Se funcionário especificado, validar disponibilidade
    let funcionarioSelecionado = id_funcionario || null;
    if (funcionarioSelecionado) {
      const livre = await funcionarioDisponivel(dt.date, dt.time, durationMinutes, funcionarioSelecionado);
      if (!livre) {
        return res.status(409).json({ error: 'Horário indisponível para o funcionário selecionado' });
      }
    } else {
      // escolher automaticamente
      funcionarioSelecionado = await escolherFuncionarioDisponivel(dt.date, dt.time, durationMinutes);
      if (!funcionarioSelecionado) {
        return res.status(409).json({ error: 'Horário indisponível: todos os funcionários ocupados' });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [resInsert] = await connection.execute(
      'INSERT INTO Agendamento (id_cliente, id_funcionario, data_agendamento, hora_agendamento, observacoes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id_cliente, funcionarioSelecionado, dt.date, dt.time, observacoes, 'Agendado']
    );
    const id_agendamento = resInsert.insertId;

    // inserir serviços (se houver)
    for (const svc of services) {
      const sid = svc.id_servico || svc.servico_id || null;
      const qtd = Number(svc.quantidade || svc.qtd || 1) || 1;
      const price = (typeof svc.preco_unitario !== 'undefined') ? svc.preco_unitario : (svc.preco || null);
      const obs = svc.observacoes || svc.obs || null;
      if (sid) {
        await connection.execute(
          'INSERT INTO AgendamentoServico (id_agendamento, id_servico, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)',
          [id_agendamento, sid, qtd, price, obs]
        );
      }
    }

    // inserir pagamentos (se houver)
    for (const pay of payments) {
      const id_forma = pay.id_forma || pay.forma_id || null;
      const metodo = pay.metodo || pay.method || null;
      const valor = pay.valor || pay.amount || 0;
      const referencia = pay.referencia || pay.ref || null;
      await connection.execute(
        'INSERT INTO AgendamentoPagamento (id_agendamento, id_forma, metodo, valor, referencia) VALUES (?, ?, ?, ?, ?)',
        [id_agendamento, id_forma, metodo, valor, referencia]
      );
    }

    await connection.commit();
    res.status(201).json({ id: id_agendamento, funcionario: funcionarioSelecionado, duration_minutes: durationMinutes, message: 'Agendamento criado com sucesso' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor', detalhes: String(error && error.message || error) });
  } finally {
    if (connection) connection.release();
  }
});

// Confirmar agendamento (muda status e notifica cliente)
// Confirmar (aceitar) agendamento: apenas Gerente ou Dono (loja)
app.post('/api/agendamentos/:id/confirmar', authenticateToken, async (req, res) => {
  const role = req.user && req.user.role;
  if (!['Gerente','Dono'].includes(role)) {
    return res.status(403).json({ error: 'Somente a loja (Gerente/Dono) pode confirmar o agendamento' });
  }
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM Agendamento WHERE id_agendamento = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const ag = rows[0];
    if (ag.status === 'Confirmado') return res.status(200).json({ message: 'Agendamento já confirmado' });
    if (ag.status === 'Cancelado') return res.status(400).json({ error: 'Agendamento cancelado não pode ser confirmado' });
    await pool.execute('UPDATE Agendamento SET status = ? WHERE id_agendamento = ?', ['Confirmado', id]);
    await notifyClienteAgendamento(ag.id_cliente, ag, 'confirmacao');
    res.json({ message: 'Agendamento confirmado e cliente notificado' });
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cliente confirma presença (quando chegar). Se foi criado por barbeiro ou já confirmado pela loja.
app.post('/api/agendamentos/:id/presenca', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!req.user || req.user.role !== 'Cliente') {
    return res.status(403).json({ error: 'Somente o cliente pode confirmar presença' });
  }
  try {
    const [rows] = await pool.execute('SELECT * FROM Agendamento WHERE id_agendamento = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const ag = rows[0];
    if (ag.id_cliente !== req.user.id) return res.status(403).json({ error: 'Este agendamento pertence a outro cliente' });
    if (!['Agendado','Confirmado'].includes(ag.status)) {
      return res.status(400).json({ error: 'Status atual não permite confirmação de presença' });
    }
    // Marca como EmAndamento (presença confirmada)
    await pool.execute('UPDATE Agendamento SET status = ? WHERE id_agendamento = ?', ['EmAndamento', id]);
    res.json({ message: 'Presença confirmada', status: 'EmAndamento' });
  } catch (error) {
    console.error('Erro ao confirmar presença:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== Rotina automática para atualizar status de agendamentos =====
// Valor configurável via tabela Configuracao (chave: no_show_grace)
async function getConfigValue(key, defaultValue) {
  try {
    const [rows] = await pool.execute('SELECT valor FROM Configuracao WHERE chave = ?', [key]);
    if (!rows.length) return defaultValue;
    const v = rows[0].valor;
    const num = Number(v);
    return Number.isFinite(num) ? num : v;
  } catch (e) {
    return defaultValue;
  }
}
async function ensureConfigTable() {
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS Configuracao (
      chave VARCHAR(64) PRIMARY KEY,
      valor VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // garante valor padrão se não existir
    const [r] = await pool.execute('SELECT valor FROM Configuracao WHERE chave=?', ['no_show_grace']);
    if (!r.length) {
      await pool.execute('INSERT INTO Configuracao (chave, valor) VALUES (?, ?)', ['no_show_grace', '10']);
    }
  } catch (e) {
    console.warn('Não foi possível garantir tabela Configuracao:', e.message);
  }
}
ensureConfigTable();
async function processAgendamentosStatus() {
  let connection;
  try {
    connection = await pool.getConnection();
    const NO_SHOW_GRACE_MINUTES = await getConfigValue('no_show_grace', 10);
    // Iniciar agendamentos confirmados cuja hora já chegou
    await connection.execute(`
      UPDATE Agendamento 
      SET status='EmAndamento'
      WHERE status='Confirmado'
        AND CONCAT(data_agendamento,' ',hora_agendamento) <= NOW()
    `);
    // Marcar falta após período de tolerância
    await connection.execute(`
      UPDATE Agendamento
      SET status='Falta'
      WHERE status='EmAndamento'
        AND TIMESTAMPDIFF(MINUTE, CONCAT(data_agendamento,' ',hora_agendamento), NOW()) >= ?
    `, [NO_SHOW_GRACE_MINUTES]);
  } catch (err) {
    console.warn('Falha processando estados de agendamento:', err.message);
  } finally {
    if (connection) connection.release();
  }
}
// Executa a cada minuto
setInterval(processAgendamentosStatus, 60 * 1000);

// ===== Endpoints de Configuração =====
// Lista todas as configurações
app.get('/api/config', authenticateToken, async (req, res) => {
  const role = req.user && req.user.role;
  if (!['Gerente','Dono'].includes(role)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    const [rows] = await pool.execute('SELECT chave, valor FROM Configuracao');
    const map = {};
    rows.forEach(r => map[r.chave] = r.valor);
    res.json(map);
  } catch (e) {
    console.error('Erro ao listar configurações:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualiza valor de no_show_grace
app.put('/api/config/no_show_grace', authenticateToken, async (req, res) => {
  const role = req.user && req.user.role;
  if (!['Gerente','Dono'].includes(role)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const { valor } = req.body;
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0 || num > 240) {
    return res.status(400).json({ error: 'Valor inválido (0-240 minutos)' });
  }
  try {
    await pool.execute('UPDATE Configuracao SET valor=? WHERE chave=?', [String(num), 'no_show_grace']);
    res.json({ chave: 'no_show_grace', valor: num });
  } catch (e) {
    console.error('Erro ao atualizar no_show_grace:', e);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/agendamentos/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const rawDate = (typeof req.body.data_agendamento !== 'undefined') ? req.body.data_agendamento : (req.body.data || req.body.date);
    const rawTime = (typeof req.body.hora_agendamento !== 'undefined') ? req.body.hora_agendamento : (req.body.hora || req.body.time);
    const dt = parseDateTimeFields(rawDate, rawTime);

    const id_cliente = (typeof req.body.id_cliente !== 'undefined') ? req.body.id_cliente : (req.body.cliente_id || null);
    const id_funcionario = (typeof req.body.id_funcionario !== 'undefined') ? req.body.id_funcionario : (req.body.funcionario_id || null);
    const status = (typeof req.body.status !== 'undefined') ? req.body.status : null;
    const observacoes = (typeof req.body.observacoes !== 'undefined') ? req.body.observacoes : null;

    const services = Array.isArray(req.body.services) ? req.body.services : (req.body.id_servico ? [{ id_servico: req.body.id_servico, quantidade: req.body.quantidade || 1, preco_unitario: req.body.preco || null }] : []);
    const payments = Array.isArray(req.body.payments) ? req.body.payments : (req.body.payments ? req.body.payments : []);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Atualiza campos principais no Agendamento
    await connection.execute(
      'UPDATE Agendamento SET id_cliente = ?, id_funcionario = ?, data_agendamento = ?, hora_agendamento = ?, status = ?, observacoes = ? WHERE id_agendamento = ?',
      [id_cliente || null, id_funcionario || null, dt.date || null, dt.time || null, status, observacoes, id]
    );

    // Substitui serviços: remove os antigos e insere os novos
    await connection.execute('DELETE FROM AgendamentoServico WHERE id_agendamento = ?', [id]);
    for (const svc of services) {
      const sid = svc.id_servico || svc.servico_id || null;
      const qtd = Number(svc.quantidade || svc.qtd || 1) || 1;
      const price = (typeof svc.preco_unitario !== 'undefined') ? svc.preco_unitario : (svc.preco || null);
      const obs = svc.observacoes || svc.obs || null;
      if (sid) {
        await connection.execute(
          'INSERT INTO AgendamentoServico (id_agendamento, id_servico, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)',
          [id, sid, qtd, price, obs]
        );
      }
    }

    // Substitui pagamentos
    await connection.execute('DELETE FROM AgendamentoPagamento WHERE id_agendamento = ?', [id]);
    for (const pay of payments) {
      const id_forma = pay.id_forma || pay.forma_id || null;
      const metodo = pay.metodo || pay.method || null;
      const valor = pay.valor || pay.amount || 0;
      const referencia = pay.referencia || pay.ref || null;
      await connection.execute(
        'INSERT INTO AgendamentoPagamento (id_agendamento, id_forma, metodo, valor, referencia) VALUES (?, ?, ?, ?, ?)',
        [id, id_forma, metodo, valor, referencia]
      );
    }

    await connection.commit();
    res.json({ message: 'Agendamento atualizado com sucesso' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT status FROM Agendamento WHERE id_agendamento = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    // Marca como Cancelado (soft delete)
    await pool.execute('UPDATE Agendamento SET status = ? WHERE id_agendamento = ?', ['Cancelado', id]);
    res.json({ message: 'Agendamento marcado como cancelado (soft delete)' });
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Agendamento por ID
app.get('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT a.id_agendamento, a.status, a.observacoes,
              DATE_FORMAT(a.data_agendamento, '%Y-%m-%d') AS data,
              TIME_FORMAT(a.hora_agendamento, '%H:%i:%s') AS hora,
              a.id_cliente, a.id_funcionario
       FROM Agendamento a
       WHERE a.id_agendamento = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const ag = rows[0];

    // duração total e hora fim derivadas
    const [duracaoRows] = await pool.execute(
      `SELECT SEC_TO_TIME(IFNULL(SUM(TIME_TO_SEC(s.duracao)),0)) AS duracao_total,
              TIME_FORMAT(ADDTIME(a.hora_agendamento, SEC_TO_TIME(IFNULL(SUM(TIME_TO_SEC(s.duracao)),0))), '%H:%i:%s') AS hora_fim
       FROM Agendamento a
       LEFT JOIN AgendamentoServico asv ON asv.id_agendamento = a.id_agendamento
       LEFT JOIN Servico s ON s.id_servico = asv.id_servico
       WHERE a.id_agendamento = ?
       GROUP BY a.id_agendamento`,
      [id]
    );
    const deriv = duracaoRows.length ? duracaoRows[0] : { duracao_total: '00:00:00', hora_fim: ag.hora };

    // buscar serviços e pagamentos
    const [services] = await pool.execute('SELECT id_agendamento_servico AS id, id_servico, quantidade, preco_unitario, observacoes FROM AgendamentoServico WHERE id_agendamento = ?', [id]);
    const [payments] = await pool.execute('SELECT id_agendamento_pagamento AS id, id_forma, metodo, valor, referencia, criado_em FROM AgendamentoPagamento WHERE id_agendamento = ?', [id]);
    res.json({ ...ag, ...deriv, services, payments });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 5. Vendas
app.get('/api/vendas', async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;
    const toIsoDate = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    let whereClause = '';
    const params = [];

    if (filter && filter !== 'all') {
      const today = new Date();
      let start = null;
      let end = null;
      switch (filter) {
        case 'last7':
          end = new Date(today);
          start = new Date(today);
          start.setDate(start.getDate() - 6);
          break;
        case 'month':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case '3months':
          end = new Date(today);
          start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
          break;
        case '6months':
          end = new Date(today);
          start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
          break;
        case 'year':
          start = new Date(today.getFullYear(), 0, 1);
          end = new Date(today.getFullYear(), 11, 31);
          break;
        case 'lastyear':
          start = new Date(today.getFullYear() - 1, 0, 1);
          end = new Date(today.getFullYear() - 1, 11, 31);
          break;
        case 'custom':
          if (start_date && end_date) {
            start = new Date(start_date);
            end = new Date(end_date);
          }
          break;
        default:
          break;
      }

      if (start && end) {
        const s = toIsoDate(start);
        const e = toIsoDate(end);
        whereClause = 'WHERE DATE(o.data_ordem_atendimento) BETWEEN ? AND ?';
        params.push(s, e);
      }
    } else if (start_date && end_date) {
      whereClause = 'WHERE DATE(o.data_ordem_atendimento) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const clienteIdsParam = req.query.cliente_ids;
    const clienteFilter = req.query.cliente;
    const pagamentoFilter = req.query.pagamento;
    if (clienteIdsParam) {
      const ids = String(clienteIdsParam).split(',').map(s => Number(s)).filter(n => !isNaN(n));
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const clause = ` o.id_cliente IN (${placeholders}) `;
        if (whereClause) whereClause += ` AND ${clause}`; else whereClause = `WHERE ${clause}`;
        params.push(...ids);
      }
    } else if (clienteFilter) {
      const clause = ' LOWER(uc.nome) LIKE ? ';
      if (whereClause) whereClause += ` AND ${clause}`; else whereClause = `WHERE ${clause}`;
      params.push(`%${String(clienteFilter).toLowerCase()}%`);
    }

    if (pagamentoFilter) {
      const clause = ' (op.metodo = ? OR op.id_forma = ?) ';
      if (whereClause) whereClause += ` AND ${clause}`; else whereClause = `WHERE ${clause}`;
      params.push(pagamentoFilter, pagamentoFilter);
    }

    const sortField = String(req.query.sort_field || '').toLowerCase();
    const sortDir = String(req.query.sort_dir || '').toUpperCase();
    let orderBy = 'o.data_ordem_atendimento DESC';
    if (sortField) {
      const dir = (sortDir === 'ASC') ? 'ASC' : 'DESC';
      if (sortField === 'valor') orderBy = `o.valor ${dir}`;
      else if (sortField === 'data') orderBy = `o.data_ordem_atendimento ${dir}`;
    }

    const sql = `
      SELECT 
        o.id_ordem_atendimento AS id_venda,
        DATE_FORMAT(o.data_ordem_atendimento, '%Y-%m-%d') AS data,
        o.valor,
        uc.nome AS cliente_nome,
        uf.nome AS funcionario_nome,
        GROUP_CONCAT(DISTINCT s.nome_servico SEPARATOR ', ') AS nome_servico,
        COALESCE(GROUP_CONCAT(DISTINCT op.metodo SEPARATOR ', '), '') AS pagamento
      FROM OrdemAtendimento o
      LEFT JOIN Usuarios uc ON o.id_cliente = uc.id_usuario
      LEFT JOIN Usuarios uf ON o.id_funcionario = uf.id_usuario
      LEFT JOIN OrdemServico osv ON osv.id_ordem_atendimento = o.id_ordem_atendimento
      LEFT JOIN Servico s ON osv.id_servico = s.id_servico
      LEFT JOIN OrdemPagamento op ON op.id_ordem_atendimento = o.id_ordem_atendimento
      ${whereClause}
      GROUP BY o.id_ordem_atendimento
      ORDER BY ${orderBy}
    `;

    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r => ({ ...r, nome_servico: r.nome_servico || '', pagamento: r.pagamento || '' })));
  } catch (error) {
    console.error('Erro ao buscar vendas (ordens):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/vendas', async (req, res) => {
  let connection;
  try {
    console.log('POST /api/vendas payload:', req.body);
    const id_agendamento = req.body.id_agendamento || null;
    const id_cliente = req.body.id_cliente;
    const id_funcionario = req.body.id_funcionario || null;
    const services = Array.isArray(req.body.services) ? req.body.services : (req.body.id_servico ? [{ id_servico: req.body.id_servico, quantidade: req.body.quantidade || 1, preco_unitario: req.body.preco || null }] : []);
    let payments = Array.isArray(req.body.payments) ? req.body.payments : [];

    if (!id_cliente) return res.status(400).json({ error: 'id_cliente obrigatório' });

    let total = req.body.valor;
    if (typeof total === 'undefined' || total === null) {
      total = services.reduce((acc, s) => acc + (Number(s.preco_unitario || s.preco || 0) * (Number(s.quantidade || 1) || 1)), 0);
    }

    if (!payments.length && req.body.pagamento) {
      payments = [{ metodo: req.body.pagamento, valor: total }];
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [r] = await connection.execute(
      'INSERT INTO OrdemAtendimento (id_agendamento, id_cliente, id_funcionario, valor) VALUES (?, ?, ?, ?)',
      [id_agendamento, id_cliente, id_funcionario, total]
    );
    const id_ordem = r.insertId;

    for (const svc of services) {
      const sid = svc.id_servico || svc.servico_id || null;
      const qtd = Number(svc.quantidade || svc.qtd || 1) || 1;
      let price = (typeof svc.preco_unitario !== 'undefined') ? svc.preco_unitario : (svc.preco || null);
      if (price === null && services.length === 1 && total) price = total; // fallback para orçamento simples
      if (sid) {
        await connection.execute(
          'INSERT INTO OrdemServico (id_ordem_atendimento, id_servico, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
          [id_ordem, sid, qtd, price]
        );
      }
    }

    for (const pay of payments) {
      const id_forma = pay.id_forma || pay.forma_id || null;
      const metodo = pay.metodo || pay.method || null;
      const valor = pay.valor || pay.amount || total || 0;
      const referencia = pay.referencia || pay.ref || null;
      await connection.execute(
        'INSERT INTO OrdemPagamento (id_ordem_atendimento, id_forma, metodo, valor, referencia) VALUES (?, ?, ?, ?, ?)',
        [id_ordem, id_forma, metodo, valor, referencia]
      );
    }

    await connection.commit();
    res.status(201).json({ id: id_ordem, message: 'Ordem (venda) registrada com sucesso' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao registrar venda (ordem):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (connection) connection.release();
  }
});

// 6. Relatórios
app.get('/api/relatorios', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Relatorio ORDER BY data_geracao DESC');
    res.json(rows);
  } catch (error) {
    // Se a tabela Relatorio não existir no schema fornecido, retornar array vazio em vez de erro crítico
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Tabela Relatorio não encontrada no banco; retornando lista vazia');
      return res.json([]);
    }
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para servir o arquivo HTML principal (página pública: home)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Iniciar servidor local
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);

  // Inicia o ngrok automaticamente
  try {
    const ngrok = require('@ngrok/ngrok');
    // O authtoken deve estar configurado como variável de ambiente NGROK_AUTHTOKEN
    const listener = await ngrok.connect({ addr: PORT, authtoken_from_env: true });
    console.log(`🌍 Endpoint público ngrok: ${listener.url()}`);
  } catch (err) {
    console.warn('ngrok não iniciado:', err.message);
  }
});
