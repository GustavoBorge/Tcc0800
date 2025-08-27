# 🚀 Guia Rápido - Sistema Barbearia IA

## ⚡ Início Rápido

### 1. Pré-requisitos
- ✅ Node.js instalado
- ✅ MySQL rodando
- ✅ Navegador web

### 2. Configuração (5 minutos)

#### 2.1 Banco de Dados
```sql
-- Execute no MySQL:
CREATE DATABASE barbe_ia;
USE barbe_ia;

-- Execute o script completo do README.md ou use o arquivo dados-exemplo.sql
```

#### 2.2 Configuração do Sistema
Edite o arquivo `config.env`:
```env
MYSQLHOST=localhost
MYSQLPORT=3306
MYSQLUSER=root
MYSQLPASSWORD=sua_senha_aqui
MYSQLDATABASE=barbe_ia
PORT=8081
JWT_SECRET=chave_secreta_123
```

### 3. Instalação e Execução

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# OU para desenvolvimento (auto-reload)
npm run dev
```

### 4. Acessar Sistema
🌐 **URL**: http://localhost:8081

## 📊 Dados de Exemplo

Para testar com dados prontos, execute:
```sql
-- No MySQL, execute o arquivo dados-exemplo.sql
source dados-exemplo.sql;
```

**Dados incluídos:**
- 5 funcionários
- 5 clientes
- 7 serviços
- 19 agendamentos
- 19 vendas
- Relatórios de exemplo

## 🎯 Primeiros Passos

1. **Acesse o Dashboard** - Veja as estatísticas
2. **Cadastre um Funcionário** - Vá em "Funcionários" → "Novo Funcionário"
3. **Cadastre um Serviço** - Vá em "Serviços" → "Novo Serviço"
4. **Cadastre um Cliente** - Vá em "Clientes" → "Novo Cliente"
5. **Crie um Agendamento** - Vá em "Agendamentos" → "Novo Agendamento"
6. **Registre uma Venda** - Vá em "Vendas" → "Nova Venda"

## 🔧 Comandos Úteis

```bash
# Verificar se Node.js está instalado
node --version

# Verificar se MySQL está rodando
mysql --version

# Parar servidor
Ctrl + C

# Ver logs do servidor
# (aparecem no terminal onde você executou npm start)
```

## 🐛 Problemas Comuns

### Erro: "Cannot connect to MySQL"
- Verifique se o MySQL está rodando
- Confirme a senha no `config.env`
- Teste: `mysql -u root -p`

### Erro: "Port 8081 is already in use"
- Mude a porta no `config.env`: `PORT=8082`
- Ou mate o processo: `netstat -ano | findstr :8081`

### Erro: "Module not found"
- Execute: `npm install`
- Verifique se o arquivo `package.json` existe

### Página não carrega
- Verifique se o servidor está rodando
- Confirme a URL: http://localhost:8081
- Verifique o console do navegador (F12)

## 📱 Testando Funcionalidades

### Dashboard
- ✅ Estatísticas em tempo real
- ✅ Gráfico de vendas
- ✅ Contadores de clientes/funcionários

### CRUD Completo
- ✅ Criar registros
- ✅ Listar dados
- ✅ Editar informações
- ✅ Excluir registros
- ✅ Busca em tempo real

### Responsividade
- ✅ Desktop (1920x1080)
- ✅ Tablet (768x1024)
- ✅ Mobile (375x667)

## 🎨 Personalização Rápida

### Mudar Cores
Edite `public/styles.css`:
```css
:root {
    --primary-color: #667eea;    /* Sua cor principal */
    --secondary-color: #764ba2;  /* Sua cor secundária */
}
```

### Mudar Nome
Edite `public/index.html`:
```html
<h1><i class="fas fa-cut"></i> Nome da Sua Barbearia</h1>
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no terminal
2. Confirme as configurações do banco
3. Teste a conexão MySQL manualmente
4. Verifique se todas as dependências foram instaladas

## 🎉 Pronto!

Seu sistema está funcionando! Agora você pode:
- Gerenciar clientes, funcionários e serviços
- Criar agendamentos
- Registrar vendas
- Visualizar relatórios
- Monitorar métricas no dashboard

**Sistema Barbearia IA - Pronto para uso! 🚀**
