# Sistema Barbearia IA

Sistema completo de gerenciamento para barbearia com interface moderna e integração com banco de dados MySQL.

## 🚀 Funcionalidades

- **Dashboard Interativo**: Visualização de estatísticas e gráficos de vendas
- **Gestão de Clientes**: Cadastro, edição e exclusão de clientes
- **Gestão de Funcionários**: Controle de funcionários e status
- **Gestão de Serviços**: Cadastro de serviços com preços e duração
- **Agendamentos**: Sistema completo de agendamento de horários
- **Vendas**: Registro e controle de vendas
- **Relatórios**: Geração de relatórios diversos
- **Interface Responsiva**: Design moderno e adaptável a diferentes dispositivos

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js + Express
- **Banco de Dados**: MySQL
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Gráficos**: Chart.js
- **Ícones**: Font Awesome
- **Design**: CSS Grid, Flexbox, Gradientes

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- MySQL (versão 5.7 ou superior)
- NPM ou Yarn

## 🔧 Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd barbe-ia
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o banco de dados

#### 3.1 Crie o banco de dados
Execute o script SQL fornecido no seu MySQL:

```sql
CREATE DATABASE barbe_ia;
USE barbe_ia;

-- Tabela UF (Unidade Federativa)
CREATE TABLE UF (
    id_uf INT PRIMARY KEY AUTO_INCREMENT,
    nome_uf VARCHAR(50) NOT NULL,
    sigla CHAR(2) NOT NULL
);

CREATE TABLE Cidade (
    id_cidade INT PRIMARY KEY AUTO_INCREMENT,
    nome_cidade VARCHAR(100) NOT NULL,
    id_uf INT,
    FOREIGN KEY (id_uf) REFERENCES UF(id_uf)
);

CREATE TABLE Relatorio (
    id_relatorio INT PRIMARY KEY AUTO_INCREMENT,
    consulta TEXT,
    design VARCHAR(100),
    data_geracao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Funcionario (
    id_funcionario INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE Gerente (
    id_gerente INT PRIMARY KEY AUTO_INCREMENT,
    id_funcionario INT UNIQUE NOT NULL,
    nivel_acesso ENUM('gerente', 'supervisor') NOT NULL DEFAULT 'gerente',
    senha VARCHAR(255) NOT NULL,
    id_relatorio INT,
    FOREIGN KEY (id_funcionario) REFERENCES Funcionario(id_funcionario),
    FOREIGN KEY (id_relatorio) REFERENCES Relatorio(id_relatorio)
);

CREATE TABLE Cliente (
    id_cliente INT PRIMARY KEY AUTO_INCREMENT,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    senha VARCHAR(255),
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacoes TEXT
);

CREATE TABLE Endereco (
    id_endereco INT PRIMARY KEY AUTO_INCREMENT,
    id_cliente INT,
    cep VARCHAR(10),
    rua VARCHAR(100),
    complemento VARCHAR(100),
    id_cidade INT,
    quadra VARCHAR(50),
    lote VARCHAR(50),
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
    FOREIGN KEY (id_cidade) REFERENCES Cidade(id_cidade)
);

CREATE TABLE Servico (
    id_servico INT PRIMARY KEY AUTO_INCREMENT,
    nome_servico VARCHAR(100) NOT NULL,
    descricao TEXT,
    duracao TIME,
    preco DECIMAL(10,2),
    ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE Especialidade (
    id_especialidade INT PRIMARY KEY AUTO_INCREMENT,
    id_funcionario INT,
    id_servico INT,
    UNIQUE KEY (id_funcionario, id_servico),
    FOREIGN KEY (id_funcionario) REFERENCES Funcionario(id_funcionario),
    FOREIGN KEY (id_servico) REFERENCES Servico(id_servico)
);

CREATE TABLE Agenda (
    id_agendamento INT PRIMARY KEY AUTO_INCREMENT,
    id_servico INT,
    id_cliente INT,
    id_funcionario INT,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    status ENUM('agendado', 'confirmado', 'realizado', 'cancelado', 'falta') NOT NULL DEFAULT 'agendado',
    observacoes TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_servico) REFERENCES Servico(id_servico),
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
    FOREIGN KEY (id_funcionario) REFERENCES Funcionario(id_funcionario)
);

CREATE TABLE Venda (
    id_venda INT PRIMARY KEY AUTO_INCREMENT,
    id_funcionario INT,
    id_cliente INT,
    id_servico INT,
    id_agendamento INT,
    valor DECIMAL(10,2),
    pagamento VARCHAR(50),
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_funcionario) REFERENCES Funcionario(id_funcionario),
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
    FOREIGN KEY (id_servico) REFERENCES Servico(id_servico),
    FOREIGN KEY (id_agendamento) REFERENCES Agenda(id_agendamento)
);

-- Índices para melhorar performance
CREATE INDEX idx_cliente_nome ON Cliente(nome);
CREATE INDEX idx_funcionario_nome ON Funcionario(nome);
CREATE INDEX idx_agenda_data_hora ON Agenda(data, hora);
CREATE INDEX idx_agenda_status ON Agenda(status);
CREATE INDEX idx_servico_nome ON Servico(nome_servico);
```

#### 3.2 Configure as variáveis de ambiente
Edite o arquivo `config.env` com suas configurações:

```env
MYSQLHOST=localhost
MYSQLPORT=3306
MYSQLUSER=root
MYSQLPASSWORD=sua_senha_aqui
MYSQLDATABASE=barbe_ia
PORT=8081
JWT_SECRET=sua_chave_secreta_aqui
```

### 4. Inicie o servidor
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

### 5. Acesse a aplicação
Abra seu navegador e acesse: `http://localhost:8081`

## 📱 Como Usar

### Dashboard
- Visualize estatísticas em tempo real
- Gráfico de vendas dos últimos 7 dias
- Resumo de clientes, funcionários e agendamentos

### Clientes
- Clique em "Novo Cliente" para cadastrar
- Use a barra de busca para filtrar
- Clique nos ícones de editar/excluir para gerenciar

### Funcionários
- Cadastre funcionários com status ativo/inativo
- Gerencie informações de contato
- Controle de acesso por nível

### Serviços
- Defina serviços com preços e duração
- Configure status ativo/inativo
- Adicione descrições detalhadas

### Agendamentos
- Crie agendamentos vinculando cliente, funcionário e serviço
- Controle status (agendado, confirmado, realizado, etc.)
- Visualize agenda completa

### Vendas
- Registre vendas com diferentes formas de pagamento
- Vincule a agendamentos existentes ou crie vendas diretas
- Controle financeiro completo

### Relatórios
- Gere relatórios de vendas, agendamentos e clientes
- Exporte dados para análise

## 🔒 Segurança

- Validação de dados no frontend e backend
- Sanitização de inputs
- Prepared statements para prevenir SQL injection
- Controle de acesso por níveis

## 📊 API Endpoints

### Clientes
- `GET /api/clientes` - Listar todos os clientes
- `POST /api/clientes` - Criar novo cliente
- `PUT /api/clientes/:id` - Atualizar cliente
- `DELETE /api/clientes/:id` - Excluir cliente

### Funcionários
- `GET /api/funcionarios` - Listar todos os funcionários
- `POST /api/funcionarios` - Criar novo funcionário
- `PUT /api/funcionarios/:id` - Atualizar funcionário
- `DELETE /api/funcionarios/:id` - Excluir funcionário

### Serviços
- `GET /api/servicos` - Listar todos os serviços
- `POST /api/servicos` - Criar novo serviço
- `PUT /api/servicos/:id` - Atualizar serviço
- `DELETE /api/servicos/:id` - Excluir serviço

### Agendamentos
- `GET /api/agendamentos` - Listar todos os agendamentos
- `POST /api/agendamentos` - Criar novo agendamento
- `PUT /api/agendamentos/:id` - Atualizar agendamento
- `DELETE /api/agendamentos/:id` - Excluir agendamento

### Vendas
- `GET /api/vendas` - Listar todas as vendas
- `POST /api/vendas` - Registrar nova venda

## 🎨 Personalização

### Cores
As cores principais podem ser alteradas no arquivo `public/styles.css`:

```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #48bb78;
    --danger-color: #f56565;
    --warning-color: #ed8936;
}
```

### Logo e Branding
Edite o header no arquivo `public/index.html` para personalizar o nome e logo da barbearia.

## 🐛 Solução de Problemas

### Erro de conexão com banco de dados
1. Verifique se o MySQL está rodando
2. Confirme as credenciais no arquivo `config.env`
3. Certifique-se de que o banco `barbe_ia` foi criado

### Erro de porta em uso
Altere a porta no arquivo `config.env`:
```env
PORT=8082
```

### Problemas de CORS
O sistema já está configurado para aceitar requisições de qualquer origem. Se necessário, ajuste no arquivo `server.js`.

## 📈 Melhorias Futuras

- [ ] Sistema de autenticação e autorização
- [ ] Notificações push para agendamentos
- [ ] Integração com WhatsApp
- [ ] Relatórios em PDF
- [ ] Backup automático do banco
- [ ] App mobile
- [ ] Integração com sistemas de pagamento
- [ ] Dashboard mais detalhado com métricas avançadas

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Autor

**Seu Nome**
- Email: seu.email@exemplo.com
- LinkedIn: [Seu LinkedIn](https://linkedin.com/in/seu-perfil)

## 🙏 Agradecimentos

- Font Awesome pelos ícones
- Chart.js pelos gráficos
- Comunidade Node.js
- Todos os contribuidores

---

**Desenvolvido com ❤️ para facilitar o gerenciamento de barbearias**
