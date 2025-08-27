# Exemplos de Uso - Sistema Barbearia IA

## 🚀 Iniciando o Sistema

1. **Certifique-se de que o MySQL está rodando**
2. **Configure o banco de dados** (execute o script SQL fornecido)
3. **Ajuste as configurações** no arquivo `config.env`
4. **Instale as dependências**: `npm install`
5. **Inicie o servidor**: `npm start`
6. **Acesse**: `http://localhost:8081`

## 📋 Fluxo de Trabalho Típico

### 1. Configuração Inicial

#### Cadastrar Funcionários
1. Vá para a aba "Funcionários"
2. Clique em "Novo Funcionário"
3. Preencha:
   - Nome: "João Silva"
   - Telefone: "(11) 99999-9999"
   - Status: Ativo
4. Clique em "Salvar"

#### Cadastrar Serviços
1. Vá para a aba "Serviços"
2. Clique em "Novo Serviço"
3. Preencha:
   - Nome: "Corte Masculino"
   - Descrição: "Corte tradicional masculino"
   - Duração: "00:30"
   - Preço: "25.00"
   - Status: Ativo
4. Clique em "Salvar"

#### Cadastrar Clientes
1. Vá para a aba "Clientes"
2. Clique em "Novo Cliente"
3. Preencha:
   - Nome: "Pedro Santos"
   - CPF: "123.456.789-00"
   - Telefone: "(11) 88888-8888"
   - Email: "pedro@email.com"
4. Clique em "Salvar"

### 2. Operações Diárias

#### Criar Agendamento
1. Vá para a aba "Agendamentos"
2. Clique em "Novo Agendamento"
3. Selecione:
   - Cliente: Pedro Santos
   - Funcionário: João Silva
   - Serviço: Corte Masculino
   - Data: Hoje
   - Hora: 14:00
   - Status: Agendado
4. Clique em "Salvar"

#### Registrar Venda
1. Vá para a aba "Vendas"
2. Clique em "Nova Venda"
3. Preencha:
   - Cliente: Pedro Santos
   - Funcionário: João Silva
   - Serviço: Corte Masculino
   - Agendamento: (selecione o agendamento criado)
   - Valor: 25.00
   - Pagamento: Dinheiro
4. Clique em "Salvar"

### 3. Monitoramento

#### Dashboard
- Visualize estatísticas em tempo real
- Gráfico de vendas dos últimos 7 dias
- Total de clientes, funcionários e agendamentos

#### Relatórios
- Gere relatórios de vendas
- Analise agendamentos
- Exporte dados de clientes

## 🔧 Exemplos de Configuração

### Configuração do Banco de Dados
```sql
-- Inserir dados de exemplo
INSERT INTO Funcionario (nome, telefone) VALUES 
('João Silva', '(11) 99999-9999'),
('Maria Santos', '(11) 88888-8888'),
('Carlos Oliveira', '(11) 77777-7777');

INSERT INTO Servico (nome_servico, descricao, duracao, preco) VALUES 
('Corte Masculino', 'Corte tradicional masculino', '00:30', 25.00),
('Barba', 'Fazer a barba', '00:20', 15.00),
('Corte + Barba', 'Corte completo com barba', '00:45', 35.00),
('Hidratação', 'Tratamento capilar', '00:40', 40.00);

INSERT INTO Cliente (cpf, nome, telefone, email) VALUES 
('123.456.789-00', 'Pedro Santos', '(11) 66666-6666', 'pedro@email.com'),
('987.654.321-00', 'Ana Costa', '(11) 55555-5555', 'ana@email.com'),
('456.789.123-00', 'Lucas Lima', '(11) 44444-4444', 'lucas@email.com');
```

### Configuração de Ambiente
```env
# config.env
MYSQLHOST=localhost
MYSQLPORT=3306
MYSQLUSER=root
MYSQLPASSWORD=sua_senha_aqui
MYSQLDATABASE=barbe_ia
PORT=8081
JWT_SECRET=chave_secreta_para_jwt
```

## 📱 Interface Responsiva

### Desktop
- Navegação lateral completa
- Tabelas com todas as colunas
- Gráficos interativos

### Tablet
- Navegação adaptada
- Tabelas com scroll horizontal
- Cards responsivos

### Mobile
- Menu hambúrguer
- Tabelas com scroll
- Botões otimizados para touch

## 🎯 Dicas de Uso

### Busca Rápida
- Use as barras de busca em cada seção
- Filtre por nome, CPF, telefone, etc.
- Busca em tempo real

### Atalhos de Teclado
- `ESC`: Fechar modal
- `Enter`: Salvar formulário
- `Tab`: Navegar entre campos

### Status de Agendamentos
- **Agendado**: Horário reservado
- **Confirmado**: Cliente confirmou presença
- **Realizado**: Serviço foi prestado
- **Cancelado**: Agendamento cancelado
- **Falta**: Cliente não compareceu

### Formas de Pagamento
- Dinheiro
- Cartão de Crédito
- Cartão de Débito
- PIX
- Transferência

## 🔍 Troubleshooting

### Problema: Erro de conexão com banco
**Solução:**
1. Verifique se o MySQL está rodando
2. Confirme as credenciais no `config.env`
3. Teste a conexão manualmente

### Problema: Porta já em uso
**Solução:**
1. Altere a porta no `config.env`
2. Ou mate o processo que está usando a porta

### Problema: Dados não aparecem
**Solução:**
1. Verifique se há dados no banco
2. Confirme se as tabelas foram criadas
3. Verifique os logs do servidor

### Problema: Interface não carrega
**Solução:**
1. Verifique se o servidor está rodando
2. Confirme se acessou a URL correta
3. Verifique o console do navegador

## 📊 Métricas Importantes

### Dashboard
- **Total de Clientes**: Número total de clientes cadastrados
- **Funcionários Ativos**: Funcionários com status ativo
- **Agendamentos Hoje**: Agendamentos para o dia atual
- **Vendas do Mês**: Total de vendas no mês atual

### Gráfico de Vendas
- Mostra vendas dos últimos 7 dias
- Permite identificar tendências
- Ajuda no planejamento

## 🎨 Personalização

### Cores
Edite o arquivo `public/styles.css`:
```css
:root {
    --primary-color: #667eea;    /* Cor principal */
    --secondary-color: #764ba2;  /* Cor secundária */
    --success-color: #48bb78;    /* Verde para sucesso */
    --danger-color: #f56565;     /* Vermelho para erro */
    --warning-color: #ed8936;    /* Laranja para aviso */
}
```

### Logo
Edite o header no `public/index.html`:
```html
<h1><i class="fas fa-cut"></i> Nome da Sua Barbearia</h1>
<p>Descrição da sua barbearia</p>
```

## 🚀 Próximos Passos

1. **Configure o banco de dados** com seus dados reais
2. **Personalize a interface** com cores e logo da sua barbearia
3. **Cadastre funcionários** e serviços
4. **Comece a usar** o sistema no dia a dia
5. **Monitore as métricas** no dashboard
6. **Gere relatórios** regularmente

---

**Sistema pronto para uso! 🎉**
