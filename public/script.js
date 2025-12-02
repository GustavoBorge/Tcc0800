// Variáveis globais
let currentTab = 'dashboard';
let currentEditId = null;
let currentEditType = null;
let vendasChart = null;
let currentUser = null;

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Verificar autenticação
    checkAuthentication();
    
    setupNavigation();
    setupSearchBars();
    setupSidebar();
    setupEventListeners();
    
    if (currentUser) {
        loadDashboard();
        updateUserInfo();
    }
}

// Configuração da navegação
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    // Remove active class de todas as abas
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adiciona active class na aba selecionada
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    currentTab = tabName;
    
    // Carrega dados específicos da aba
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'clientes':
            loadClientes();
            break;
        case 'funcionarios':
            loadFuncionarios();
            break;
        case 'servicos':
            loadServicos();
            break;
        case 'agendamentos':
            loadAgendamentos();
            break;
        case 'vendas':
            loadVendas();
            break;
        case 'relatorios':
            loadRelatorios();
            break;
        case 'config':
            loadConfig();
            break;
    }
}

// Configuração das barras de busca
function setupSearchBars() {
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(input => {
        input.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const tableId = this.id.replace('search-', '');
            filterTable(tableId, searchTerm);
        });
    });
}

function filterTable(tableId, searchTerm) {
    const tbody = document.getElementById(`${tableId}-tbody`);
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Verificar autenticação
function checkAuthentication() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        
        // Redirecionar funcionários para sua tela específica
        if (currentUser.role === 'funcionario' || currentUser.role === 'gerente') {
            window.location.href = '/funcionario.html';
            return;
        }
    } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

// Atualizar informações do usuário
function updateUserInfo() {
    const userInfo = document.getElementById('user-info');
    if (userInfo && currentUser) {
        userInfo.innerHTML = `<i class="fas fa-user"></i> ${currentUser.nome} (${currentUser.role})`;
    }
}

// Configuração do sidebar
function setupSidebar() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        hamburgerBtn.classList.add('active');
    });
    
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
    hamburgerBtn.classList.remove('active');
}

// Setup de event listeners
function setupEventListeners() {
    // Fechar modal ao clicar fora
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('modal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
}

// Dashboard
async function loadDashboard() {
    showLoading();
    try {
        const token = localStorage.getItem('token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        const [clientes, funcionarios, agendamentos, vendas] = await Promise.all([
            fetch('/api/clientes', { headers }).then(res => res.json()),
            fetch('/api/funcionarios', { headers }).then(res => res.json()),
            fetch('/api/agendamentos', { headers }).then(res => res.json()),
            fetch('/api/vendas', { headers }).then(res => res.json())
        ]);
        
        updateDashboardStats(clientes, funcionarios, agendamentos, vendas);
        createVendasChart(vendas);
    } catch (error) {
        showToast('Erro ao carregar dashboard', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

function updateDashboardStats(clientes, funcionarios, agendamentos, vendas) {
    // Total de clientes
    document.getElementById('total-clientes').textContent = clientes.length;
    
    // Funcionários ativos
    const funcionariosAtivos = funcionarios.filter(f => f.ativo);
    document.getElementById('total-funcionarios').textContent = funcionariosAtivos.length;
    
    // Agendamentos de hoje
    const hoje = new Date().toISOString().split('T')[0];
    const agendamentosHoje = agendamentos.filter(a => a.data === hoje);
    document.getElementById('agendamentos-hoje').textContent = agendamentosHoje.length;
    
    // Vendas do mês
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    const vendasMes = vendas.filter(v => {
        const dataVenda = new Date(v.data);
        return dataVenda.getMonth() === mesAtual && dataVenda.getFullYear() === anoAtual;
    });
    
    const totalVendasMes = vendasMes.reduce((total, venda) => total + parseFloat(venda.valor || 0), 0);
    document.getElementById('vendas-mes').textContent = `R$ ${totalVendasMes.toFixed(2)}`;
}

function createVendasChart(vendas) {
    const ctx = document.getElementById('vendasChart').getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (vendasChart) {
        vendasChart.destroy();
    }
    
    // Preparar dados dos últimos 7 dias
    const ultimos7Dias = [];
    const dadosVendas = [];
    
    for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        ultimos7Dias.push(dataStr);
        
        const vendasDia = vendas.filter(v => v.data.startsWith(dataStr));
        const totalDia = vendasDia.reduce((total, v) => total + parseFloat(v.valor || 0), 0);
        dadosVendas.push(totalDia);
    }
    
    vendasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ultimos7Dias.map(data => {
                const d = new Date(data);
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }),
            datasets: [{
                label: 'Vendas (R$)',
                data: dadosVendas,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// Clientes
async function loadClientes() {
    showLoading();
    try {
        const response = await fetch('/api/clientes');
        const clientes = await response.json();
        renderClientesTable(clientes);
    } catch (error) {
        showToast('Erro ao carregar clientes', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

function renderClientesTable(clientes) {
    const tbody = document.getElementById('clientes-tbody');
    tbody.innerHTML = '';
    
    clientes.forEach(cliente => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cliente.id_usuario}</td>
            <td>${cliente.nome}</td>
            <td>${cliente.telefone || '-'}</td>
            <td>${cliente.email || '-'}</td>
            <td>${formatDate(cliente.data_cadastro)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editCliente(${cliente.id_usuario})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteCliente(${cliente.id_usuario})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openModal(type, id = null) {
    currentEditType = type;
    currentEditId = id;
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    
    switch(type) {
        case 'cliente':
            modalTitle.textContent = id ? 'Editar Cliente' : 'Novo Cliente';
            modalForm.innerHTML = getClienteForm(id);
            break;
        case 'funcionario':
            modalTitle.textContent = id ? 'Editar Funcionário' : 'Novo Funcionário';
            modalForm.innerHTML = getFuncionarioForm(id);
            break;
        case 'servico':
            modalTitle.textContent = id ? 'Editar Serviço' : 'Novo Serviço';
            modalForm.innerHTML = getServicoForm(id);
            break;
        case 'agendamento':
            modalTitle.textContent = id ? 'Editar Agendamento' : 'Novo Agendamento';
            modalForm.innerHTML = getAgendamentoForm(id);
            fillSelectsAgendamento(); // <-- Adicione esta linha
            break;
        case 'venda':
            modalTitle.textContent = 'Nova Venda';
            modalForm.innerHTML = getVendaForm();
            fillSelectsVenda(); // <-- Adicione esta linha
            break;
    }
    
    modal.style.display = 'block';
    
    // Preencher dados se for edição
    if (id) {
        fillFormData(type, id);
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    currentEditId = null;
    currentEditType = null;
}

// Formulários
function getClienteForm(id) {
    return `
        <div class="form-row">
            <div class="form-group">
                <label for="nome">Nome *</label>
                <input type="text" id="nome" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="cpf">CPF</label>
                <input type="text" id="cpf" class="form-control" placeholder="000.000.000-00">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="telefone">Telefone</label>
                <input type="text" id="telefone" class="form-control" placeholder="(00) 00000-0000">
            </div>
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" class="form-control">
            </div>
        </div>
        <div class="form-group">
            <label for="senha">Senha</label>
            <input type="password" id="senha" class="form-control">
        </div>
        <div class="form-group">
            <label for="observacoes">Observações</label>
            <textarea id="observacoes" class="form-control" rows="3"></textarea>
        </div>
    `;
}

function getFuncionarioForm(id) {
    return `
        <div class="form-row">
            <div class="form-group">
                <label for="nome">Nome *</label>
                <input type="text" id="nome" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="telefone">Telefone</label>
                <input type="text" id="telefone" class="form-control" placeholder="(00) 00000-0000">
            </div>
        </div>
        <div class="form-group">
            <label for="ativo">Status</label>
            <select id="ativo" class="form-control">
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
            </select>
        </div>
    `;
}

function getServicoForm(id) {
    return `
        <div class="form-group">
            <label for="nome_servico">Nome do Serviço *</label>
            <input type="text" id="nome_servico" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="descricao">Descrição</label>
            <textarea id="descricao" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="duracao">Duração</label>
                <input type="time" id="duracao" class="form-control">
            </div>
            <div class="form-group">
                <label for="preco">Preço (R$)</label>
                <input type="number" id="preco" class="form-control" step="0.01" min="0">
            </div>
        </div>
        <div class="form-group">
            <label for="ativo">Status</label>
            <select id="ativo" class="form-control">
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
            </select>
        </div>
    `;
}

function getAgendamentoForm(id) {
    return `
        <div class="form-row">
            <div class="form-group">
                <label for="id_cliente">Cliente *</label>
                <select id="id_cliente" class="form-control" required>
                    <option value="">Selecione um cliente</option>
                </select>
            </div>
            <div class="form-group">
                <label for="id_funcionario">Funcionário (opcional)</label>
                <select id="id_funcionario" class="form-control">
                    <option value="">Automático</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="servicos">Serviços (Ctrl+clique para múltiplos) *</label>
                <select id="servicos" class="form-control" multiple required style="min-height:120px;"></select>
            </div>
            <div class="form-group">
                <label for="data">Data *</label>
                <input type="date" id="data" class="form-control" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="hora">Hora *</label>
                <input type="time" id="hora" class="form-control" required>
            </div>
            <div class="form-group">
                <label>Duração Estimada</label>
                <div id="duracao-estimada" class="form-control" style="background:#f5f5f5;">
                    Selecione serviços
                </div>
            </div>
        </div>
        <div class="form-group">
            <label for="observacoes">Observações</label>
            <textarea id="observacoes" class="form-control" rows="3"></textarea>
        </div>
    `;
}

function getVendaForm() {
    return `
        <div class="form-row">
            <div class="form-group">
                <label for="id_cliente">Cliente *</label>
                <select id="id_cliente" class="form-control" required>
                    <option value="">Selecione um cliente</option>
                </select>
            </div>
            <div class="form-group">
                <label for="id_funcionario">Funcionário *</label>
                <select id="id_funcionario" class="form-control" required>
                    <option value="">Selecione um funcionário</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="id_servico">Serviço *</label>
                <select id="id_servico" class="form-control" required>
                    <option value="">Selecione um serviço</option>
                </select>
            </div>
            <div class="form-group">
                <label for="id_agendamento">Agendamento</label>
                <select id="id_agendamento" class="form-control">
                    <option value="">Nenhum (venda direta)</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="valor">Valor (R$) *</label>
                <input type="number" id="valor" class="form-control" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label for="pagamento">Forma de Pagamento</label>
                <select id="pagamento" class="form-control">
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                </select>
            </div>
        </div>
    `;
}

// Função para preencher selects do agendamento
async function fillSelectsAgendamento() {
    try {
        const [clientes, funcionarios, servicos] = await Promise.all([
            fetch('/api/clientes').then(res => res.json()),
            fetch('/api/funcionarios').then(res => res.json()),
            fetch('/api/servicos').then(res => res.json())
        ]);
        const clienteSelect = document.getElementById('id_cliente');
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id_usuario;
            opt.textContent = c.nome || 'Cliente';
            clienteSelect.appendChild(opt);
        });
        const funcionarioSelect = document.getElementById('id_funcionario');
        funcionarios.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id_usuario;
            opt.textContent = f.nome;
            funcionarioSelect.appendChild(opt);
        });
        const servicosSelect = document.getElementById('servicos');
        servicos.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id_servico;
            opt.textContent = `${s.nome_servico} (${s.duracao || '00:00:00'})`;
            opt.dataset.duracao = s.duracao || '00:00:00';
            servicosSelect.appendChild(opt);
        });

        // Atualiza duração estimada ao selecionar serviços
        servicosSelect.addEventListener('change', () => {
            const selecionados = Array.from(servicosSelect.selectedOptions).map(o => o.dataset.duracao);
            const minutos = selecionados.reduce((acc, dur) => {
                const [hh, mm, ss] = dur.split(':').map(Number);
                return acc + hh * 60 + mm + (ss ? Math.round(ss/60) : 0);
            }, 0);
            const h = Math.floor(minutos/60).toString().padStart(2,'0');
            const m = (minutos%60).toString().padStart(2,'0');
            document.getElementById('duracao-estimada').textContent = minutos ? `${h}:${m}` : 'Selecione serviços';
        });
    } catch (error) {
        showToast('Erro ao carregar opções do formulário', 'error');
    }
}

// Função para preencher selects da venda
async function fillSelectsVenda() {
    try {
        const [clientes, funcionarios, servicos, agendamentos] = await Promise.all([
            fetch('/api/clientes').then(res => res.json()),
            fetch('/api/funcionarios').then(res => res.json()),
            fetch('/api/servicos').then(res => res.json()),
            fetch('/api/agendamentos').then(res => res.json())
        ]);
        const clienteSelect = document.getElementById('id_cliente');
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id_usuario;
            opt.textContent = c.nome;
            clienteSelect.appendChild(opt);
        });
        const funcionarioSelect = document.getElementById('id_funcionario');
        funcionarios.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id_usuario;
            opt.textContent = f.nome;
            funcionarioSelect.appendChild(opt);
        });
        const servicoSelect = document.getElementById('id_servico');
        servicos.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id_servico;
            opt.textContent = s.nome_servico;
            servicoSelect.appendChild(opt);
        });
        const agendamentoSelect = document.getElementById('id_agendamento');
        agendamentos.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id_agendamento;
            opt.textContent = `#${a.id_agendamento} - ${a.cliente_nome || ''} (${a.data} ${a.hora})`;
            agendamentoSelect.appendChild(opt);
        });
    } catch (error) {
        showToast('Erro ao carregar opções do formulário', 'error');
    }
}

// Preencher dados do formulário para edição
async function fillFormData(type, id) {
    try {
        let response;
        switch(type) {
            case 'cliente':
                response = await fetch(`/api/clientes/${id}`);
                break;
            case 'funcionario':
                response = await fetch(`/api/funcionarios/${id}`);
                break;
            case 'servico':
                response = await fetch(`/api/servicos/${id}`);
                break;
            case 'agendamento':
                response = await fetch(`/api/agendamentos/${id}`);
                break;
        }
        
        if (response.ok) {
            const data = await response.json();
            fillFormFields(data);
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

function fillFormFields(data) {
    Object.keys(data).forEach(key => {
        const field = document.getElementById(key);
        if (field) {
            field.value = data[key];
        }
    });
}

// Salvar dados
async function saveData() {
    const formData = getFormData();
    
    if (!formData) return;
    
    showLoading();
    try {
        let response;
        const url = currentEditId ? 
            `/api/${currentEditType}s/${currentEditId}` : 
            `/api/${currentEditType}s`;

        let payload = formData;
        if (currentEditType === 'agendamento') {
            // Monta payload conforme novo formato da API
            const servicosEl = document.getElementById('servicos');
            const selecionados = Array.from(servicosEl.selectedOptions).map(o => ({ id_servico: o.value }));
            // Valida obrigatórios específicos de agendamento
            if (!formData.id_cliente) { showToast('Selecione um cliente', 'warning'); hideLoading(); return; }
            if (!formData.data) { showToast('Informe a data do agendamento', 'warning'); hideLoading(); return; }
            if (!formData.hora) { showToast('Informe a hora do agendamento', 'warning'); hideLoading(); return; }
            if (!selecionados.length) { showToast('Selecione ao menos um serviço', 'warning'); hideLoading(); return; }
            payload = {
                id_cliente: formData.id_cliente,
                id_funcionario: formData.id_funcionario || null,
                data_agendamento: formData.data,
                hora_agendamento: formData.hora,
                observacoes: formData.observacoes || null,
                services: selecionados
            };
            if (currentEditId) {
                // Para edição manter compatibilidade antiga
                payload.status = formData.status || undefined;
            }
        }

        response = await fetch(url, {
            method: currentEditId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const respText = await response.text();
        let respData = {};
        try { respData = respText ? JSON.parse(respText) : {}; } catch{}
        if (response.ok) {
            let msgBase = currentEditId ? 
                `${currentEditType.charAt(0).toUpperCase() + currentEditType.slice(1)} atualizado com sucesso!` :
                `${currentEditType.charAt(0).toUpperCase() + currentEditType.slice(1)} criado com sucesso!`;
            if (currentEditType === 'agendamento' && respData && respData.funcionario) {
                msgBase += ` | Funcionário: ${respData.funcionario} | Duração: ${respData.duration_minutes} min`;
            }
            showToast(msgBase, 'success');
            closeModal();
            refreshCurrentTab();
        } else {
            const msg = respData && (respData.error || respData.message || respText) || 'Erro na requisição';
            throw new Error(msg);
        }
    } catch (error) {
        showToast(error.message || 'Erro ao salvar dados', 'error');
        console.error('Erro ao salvar:', error);
    } finally {
        hideLoading();
    }
}

function getFormData() {
    const form = document.getElementById('modal-form');
    const formData = {};
    
    // Coletar dados dos campos
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id) {
            formData[input.id] = input.value;
        }
    });
    
    // Validação básica
    const requiredFields = form.querySelectorAll('[required]');
    for (let field of requiredFields) {
        if (!field.value.trim()) {
            showToast(`Campo ${field.previousElementSibling?.textContent || field.id} é obrigatório`, 'warning');
            field.focus();
            return null;
        }
    }
    
    return formData;
}

// Carregar dados das outras abas
async function loadFuncionarios() {
    showLoading();
    try {
        const response = await fetch('/api/funcionarios');
        const funcionarios = await response.json();
        renderFuncionariosTable(funcionarios);
    } catch (error) {
        showToast('Erro ao carregar funcionários', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

function renderFuncionariosTable(funcionarios) {
    const tbody = document.getElementById('funcionarios-tbody');
    tbody.innerHTML = '';
    
    funcionarios.forEach(funcionario => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${funcionario.id_usuario}</td>
            <td>${funcionario.nome}</td>
            <td>${funcionario.telefone || '-'}</td>
            <td>
                <span class="status-badge ${funcionario.ativo ? 'status-active' : 'status-inactive'}">
                    ${funcionario.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>${formatDate(funcionario.data_cadastro)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editFuncionario(${funcionario.id_usuario})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteFuncionario(${funcionario.id_usuario})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadServicos() {
    showLoading();
    try {
        const response = await fetch('/api/servicos');
        const servicos = await response.json();
        renderServicosTable(servicos);
    } catch (error) {
        showToast('Erro ao carregar serviços', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

function renderServicosTable(servicos) {
    const tbody = document.getElementById('servicos-tbody');
    tbody.innerHTML = '';
    
    servicos.forEach(servico => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${servico.id_servico}</td>
            <td>${servico.nome_servico}</td>
            <td>${servico.descricao || '-'}</td>
            <td>${servico.duracao || '-'}</td>
            <td>R$ ${parseFloat(servico.preco || 0).toFixed(2)}</td>
            <td>
                <span class="status-badge ${servico.ativo ? 'status-active' : 'status-inactive'}">
                    ${servico.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editServico(${servico.id_servico})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteServico(${servico.id_servico})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadAgendamentos() {
    showLoading();
    try {
        const response = await fetch('/api/agendamentos');
        const agendamentos = await response.json();
        renderAgendamentosTable(agendamentos);
    } catch (error) {
        showToast('Erro ao carregar agendamentos', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

function renderAgendamentosTable(agendamentos) {
    const tbody = document.getElementById('agendamentos-tbody');
    tbody.innerHTML = '';
    
    agendamentos.forEach(agendamento => {
        const row = document.createElement('tr');
        const podeConfirmar = String(agendamento.status).toLowerCase() === 'agendado';
        row.innerHTML = `
            <td>${agendamento.id_agendamento}</td>
            <td>${agendamento.cliente_nome}</td>
            <td>${agendamento.funcionario_nome}</td>
            <td>${(agendamento.servicos || agendamento.nome_servico || '').toString()}</td>
            <td>${formatDate(agendamento.data)}</td>
            <td>${agendamento.hora}</td>
            <td>${agendamento.duracao_total || '-'}</td>
            <td>${agendamento.hora_fim || '-'}</td>
            <td>
                <span class="status-badge status-${agendamento.status}">
                    ${agendamento.status}
                </span>
            </td>
            <td>
                <div class="action-buttons" style="gap:4px; display:flex;">
                    <button class="action-btn edit" title="Editar" onclick="editAgendamento(${agendamento.id_agendamento})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" title="Excluir" onclick="deleteAgendamento(${agendamento.id_agendamento})">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${podeConfirmar ? `<button class="action-btn" style="background:#38a169;" title="Confirmar" onclick="confirmAgendamento(${agendamento.id_agendamento})"><i class="fas fa-check"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function confirmAgendamento(id) {
    if (!id) return;
    if (!confirm('Confirmar este agendamento?')) return;
    showLoading();
    try {
        const res = await fetch(`/api/agendamentos/${id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao confirmar');
        showToast('Agendamento confirmado!', 'success');
        refreshCurrentTab();
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadVendas() {
    showLoading();
    try {
        const response = await fetch('/api/vendas');
        const vendas = await response.json();
        renderVendasTable(vendas);
    } catch (error) {
        showToast('Erro ao carregar vendas', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

function renderVendasTable(vendas) {
    const tbody = document.getElementById('vendas-tbody');
    tbody.innerHTML = '';
    
    vendas.forEach(venda => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${venda.id_venda}</td>
            <td>${venda.cliente_nome}</td>
            <td>${venda.funcionario_nome}</td>
            <td>${venda.nome_servico}</td>
            <td>R$ ${parseFloat(venda.valor || 0).toFixed(2)}</td>
            <td>${venda.pagamento || '-'}</td>
            <td>${formatDate(venda.data)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn delete" onclick="deleteVenda(${venda.id_venda})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Funções de edição
function editCliente(id) {
    openModal('cliente', id);
}

function editFuncionario(id) {
    openModal('funcionario', id);
}

function editServico(id) {
    openModal('servico', id);
}

function editAgendamento(id) {
    openModal('agendamento', id);
}

// Funções de exclusão
async function deleteCliente(id) {
    if (confirm('Inativar este cliente?')) {
        await deleteItem('clientes', id);
    }
}

async function deleteFuncionario(id) {
    if (confirm('Inativar este funcionário?')) {
        await deleteItem('funcionarios', id);
    }
}

async function deleteServico(id) {
    if (confirm('Inativar este serviço?')) {
        await deleteItem('servicos', id);
    }
}

async function deleteAgendamento(id) {
    if (confirm('Cancelar este agendamento?')) {
        await deleteItem('agendamentos', id);
    }
}

async function deleteVenda(id) {
    if (confirm('Inativar esta venda?')) {
        await deleteItem('vendas', id);
    }
}

async function deleteItem(type, id) {
    showLoading();
    try {
        let endpoint;
        switch(type){
            case 'clientes': endpoint = `/api/clientes/${id}/inativar`; break;
            case 'funcionarios': endpoint = `/api/funcionarios/${id}/inativar`; break;
            case 'servicos': endpoint = `/api/servicos/${id}/inativar`; break;
            case 'agendamentos': endpoint = `/api/agendamentos/${id}/cancelar`; break;
            default: endpoint = `/api/${type}/${id}`; // fallback
        }
        const response = await fetch(endpoint, { method: 'POST' });
        if (response.ok) {
            showToast('Item inativado com sucesso!', 'success');
            refreshCurrentTab();
        } else {
            throw new Error('Erro na requisição');
        }
    } catch (error) {
        showToast('Erro ao inativar item', 'error');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

// Relatórios
function loadRelatorios() {
    // Implementar carregamento de relatórios se necessário
}

// ===== Configurações =====
async function loadConfig() {
    const token = localStorage.getItem('token');
    if (!token || !currentUser || !['Gerente','Dono'].includes(currentUser.role)) {
        const input = document.getElementById('no_show_grace');
        if (input) input.disabled = true;
        const btn = document.getElementById('salvar-config-btn');
        if (btn) btn.style.display = 'none';
        return;
    }
    try {
        const res = await fetch('/api/config', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (res.ok) {
            const grace = document.getElementById('no_show_grace');
            if (grace) grace.value = data.no_show_grace || 10;
        }
    } catch(e) {
        showToast('Falha ao carregar configurações', 'error');
    }
    const btn = document.getElementById('salvar-config-btn');
    if (btn) {
        btn.onclick = saveConfig;
    }
}

async function saveConfig() {
    const token = localStorage.getItem('token');
    if (!token) { showToast('Sem token', 'error'); return; }
    const valEl = document.getElementById('no_show_grace');
    const valor = Number(valEl.value);
    if (!Number.isFinite(valor) || valor < 0 || valor > 240) {
        showToast('Valor inválido (0-240)', 'warning');
        return;
    }
    try {
        const res = await fetch('/api/config/no_show_grace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ valor })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
        showToast('Configuração salva', 'success');
    } catch(e) {
        showToast(e.message, 'error');
    }
}

function gerarRelatorioVendas() {
    showToast('Relatório de vendas gerado!', 'success');
}

function gerarRelatorioAgendamentos() {
    showToast('Relatório de agendamentos gerado!', 'success');
}

function gerarRelatorioClientes() {
    showToast('Relatório de clientes gerado!', 'success');
}

// Utilitários
function refreshCurrentTab() {
    switch(currentTab) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'clientes':
            loadClientes();
            break;
        case 'funcionarios':
            loadFuncionarios();
            break;
        case 'servicos':
            loadServicos();
            break;
        case 'agendamentos':
            loadAgendamentos();
            break;
        case 'vendas':
            loadVendas();
            break;
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Remover toast após 3 segundos
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Tema claro/escuro
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('toggle-theme-btn');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    setTheme(theme);

    themeBtn.addEventListener('click', () => {
        theme = (theme === 'dark') ? 'light' : 'dark';
        setTheme(theme);
        localStorage.setItem('theme', theme);
    });

    function setTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        themeBtn.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }
});
