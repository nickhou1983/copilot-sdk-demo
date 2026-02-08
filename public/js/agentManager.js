/**
 * Agent Manager UI Module
 * Handles agent CRUD operations and UI interactions
 */

// Agent state
const agentState = {
  agents: [],
  currentAgentId: null,
  editingAgent: null,
};

/**
 * Initialize agent manager
 */
function initAgentManager(socket) {
  // Request initial agent list
  socket.emit('list-agents');

  // Listen for agent events
  socket.on('agents-list', handleAgentsList);
  socket.on('agent-created', handleAgentCreated);
  socket.on('agent-updated', handleAgentUpdated);
  socket.on('agent-deleted', handleAgentDeleted);
  socket.on('default-agent-set', handleDefaultAgentSet);
}

/**
 * Handle agents list response
 */
function handleAgentsList(data) {
  if (data.success) {
    agentState.agents = data.agents;
    renderAgentSelector();
    renderAgentsList();
  } else {
    console.error('Failed to load agents:', data.error);
  }
}

/**
 * Handle agent created response
 */
function handleAgentCreated(data) {
  if (data.success) {
    agentState.agents.push(data.agent);
    renderAgentSelector();
    renderAgentsList();
    closeAgentModal();
    showToast('Agent 创建成功', 'success');
  } else {
    showToast(data.error || data.errors?.join(', ') || '创建失败', 'error');
  }
}

/**
 * Handle agent updated response
 */
function handleAgentUpdated(data) {
  if (data.success) {
    const index = agentState.agents.findIndex(a => a.id === data.agent.id);
    if (index >= 0) {
      agentState.agents[index] = data.agent;
    }
    renderAgentSelector();
    renderAgentsList();
    closeAgentModal();
    showToast('Agent 更新成功', 'success');
  } else {
    showToast(data.error || '更新失败', 'error');
  }
}

/**
 * Handle agent deleted response
 */
function handleAgentDeleted(data) {
  if (data.success) {
    agentState.agents = agentState.agents.filter(a => a.id !== data.agentId);
    if (agentState.currentAgentId === data.agentId) {
      agentState.currentAgentId = null;
    }
    renderAgentSelector();
    renderAgentsList();
    showToast('Agent 已删除', 'success');
  } else {
    showToast(data.error || '删除失败', 'error');
  }
}

/**
 * Handle default agent set response
 */
function handleDefaultAgentSet(data) {
  if (data.success) {
    // Update isDefault flags
    agentState.agents.forEach(a => {
      a.isDefault = a.id === data.agent.id;
    });
    renderAgentSelector();
    renderAgentsList();
    showToast('默认 Agent 已设置', 'success');
  }
}

/**
 * Render agent selector dropdown
 */
function renderAgentSelector() {
  const container = document.getElementById('agent-selector');
  if (!container) return;

  const currentAgent = agentState.currentAgentId
    ? agentState.agents.find(a => a.id === agentState.currentAgentId)
    : agentState.agents.find(a => a.isDefault);

  container.innerHTML = `
    <div class="agent-selector-trigger" onclick="toggleAgentDropdown()">
      <span class="agent-icon">${currentAgent?.icon || '🤖'}</span>
      <span class="agent-name">${currentAgent?.name || '选择 Agent'}</span>
      <span class="dropdown-arrow">▼</span>
    </div>
    <div class="agent-dropdown" id="agent-dropdown">
      ${agentState.agents.map(agent => `
        <div class="agent-option ${agent.id === agentState.currentAgentId ? 'selected' : ''}" 
             onclick="selectAgent('${agent.id}')">
          <span class="agent-icon">${agent.icon || '🤖'}</span>
          <div class="agent-info">
            <span class="agent-name">${agent.name}</span>
            ${agent.isDefault ? '<span class="default-badge">默认</span>' : ''}
          </div>
        </div>
      `).join('')}
      <div class="agent-option manage-agents" onclick="openAgentManagement()">
        <span class="agent-icon">⚙️</span>
        <span class="agent-name">管理 Agents</span>
      </div>
    </div>
  `;
}

/**
 * Toggle agent dropdown
 */
function toggleAgentDropdown() {
  const dropdown = document.getElementById('agent-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

/**
 * Select an agent
 */
function selectAgent(agentId) {
  agentState.currentAgentId = agentId;
  renderAgentSelector();
  toggleAgentDropdown();

  // If there's an active session, update its agent
  if (window.state?.currentSessionId) {
    window.state.socket.emit('set-session-agent', {
      sessionId: window.state.currentSessionId,
      agentId: agentId,
    });
  }
}

/**
 * Get current agent ID
 */
function getCurrentAgentId() {
  return agentState.currentAgentId || agentState.agents.find(a => a.isDefault)?.id;
}

/**
 * Open agent management modal
 */
function openAgentManagement() {
  toggleAgentDropdown();
  const modal = document.getElementById('agent-management-modal');
  if (modal) {
    modal.classList.add('show');
    renderAgentsList();
  }
}

/**
 * Close agent management modal
 */
function closeAgentManagement() {
  const modal = document.getElementById('agent-management-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

/**
 * Render agents list in management modal
 */
function renderAgentsList() {
  const container = document.getElementById('agents-list');
  if (!container) return;

  container.innerHTML = agentState.agents.map(agent => `
    <div class="agent-card" style="border-left-color: ${agent.color || '#6366f1'}">
      <div class="agent-card-header">
        <span class="agent-icon large">${agent.icon || '🤖'}</span>
        <div class="agent-card-info">
          <h3>${agent.name} ${agent.isDefault ? '<span class="default-badge">默认</span>' : ''}</h3>
          <p>${agent.description || '暂无描述'}</p>
        </div>
      </div>
      <div class="agent-card-meta">
        <span>工具组: ${agent.toolGroupIds?.length || 0}</span>
        <span>内置工具: ${agent.enabledBuiltinTools?.length || 0}</span>
        ${agent.preferredModel ? `<span>模型: ${agent.preferredModel}</span>` : ''}
      </div>
      <div class="agent-card-actions">
        <button class="btn-icon" onclick="editAgent('${agent.id}')" title="编辑">✏️</button>
        ${!agent.isDefault ? `
          <button class="btn-icon" onclick="setDefaultAgent('${agent.id}')" title="设为默认">⭐</button>
          <button class="btn-icon danger" onclick="confirmDeleteAgent('${agent.id}')" title="删除">🗑️</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Open create agent modal
 */
function openCreateAgentModal() {
  agentState.editingAgent = null;
  resetAgentForm();
  document.getElementById('agent-modal-title').textContent = '创建 Agent';
  document.getElementById('agent-modal').classList.add('show');
  
  // Load available tools and dynamic models for selection
  window.state?.socket?.emit('list-tools');
  window.state?.socket?.emit('list-tool-groups');
  loadAgentModelSelect();
}

/**
 * Edit existing agent
 */
function editAgent(agentId) {
  const agent = agentState.agents.find(a => a.id === agentId);
  if (!agent) return;

  agentState.editingAgent = agent;
  
  // Fill form with agent data
  document.getElementById('agent-name').value = agent.name;
  document.getElementById('agent-description').value = agent.description || '';
  document.getElementById('agent-system-prompt').value = agent.systemPrompt || '';
  document.getElementById('agent-icon').value = agent.icon || '🤖';
  document.getElementById('agent-color').value = agent.color || '#6366f1';
  document.getElementById('agent-preferred-model').value = agent.preferredModel || '';
  
  document.getElementById('agent-modal-title').textContent = '编辑 Agent';
  document.getElementById('agent-modal').classList.add('show');
  
  // Load and select tools + dynamic models
  window.state?.socket?.emit('list-tools');
  window.state?.socket?.emit('list-tool-groups');
  loadAgentModelSelect(agent.preferredModel);
}

/**
 * Reset agent form
 */
function resetAgentForm() {
  document.getElementById('agent-name').value = '';
  document.getElementById('agent-description').value = '';
  document.getElementById('agent-system-prompt').value = '';
  document.getElementById('agent-icon').value = '🤖';
  document.getElementById('agent-color').value = '#6366f1';
  document.getElementById('agent-preferred-model').value = '';
}

/**
 * Close agent modal
 */
function closeAgentModal() {
  document.getElementById('agent-modal').classList.remove('show');
  agentState.editingAgent = null;
}

/**
 * Save agent (create or update)
 */
function saveAgent() {
  const data = {
    name: document.getElementById('agent-name').value.trim(),
    description: document.getElementById('agent-description').value.trim(),
    systemPrompt: document.getElementById('agent-system-prompt').value,
    icon: document.getElementById('agent-icon').value || '🤖',
    color: document.getElementById('agent-color').value || '#6366f1',
    preferredModel: document.getElementById('agent-preferred-model').value || undefined,
    toolGroupIds: getSelectedToolGroups(),
    enabledBuiltinTools: getSelectedBuiltinTools(),
    enabledCustomTools: getSelectedCustomTools(),
  };

  if (!data.name) {
    showToast('请输入 Agent 名称', 'error');
    return;
  }

  if (agentState.editingAgent) {
    window.state?.socket?.emit('update-agent', {
      id: agentState.editingAgent.id,
      ...data,
    });
  } else {
    window.state?.socket?.emit('create-agent', data);
  }
}

/**
 * Get selected tool groups from form
 */
function getSelectedToolGroups() {
  const checkboxes = document.querySelectorAll('#tool-groups-select input:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Get selected builtin tools from form
 */
function getSelectedBuiltinTools() {
  const checkboxes = document.querySelectorAll('#builtin-tools-select input:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Get selected custom tools from form
 */
function getSelectedCustomTools() {
  const checkboxes = document.querySelectorAll('#custom-tools-select input:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Set agent as default
 */
function setDefaultAgent(agentId) {
  window.state?.socket?.emit('set-default-agent', { agentId });
}

/**
 * Confirm and delete agent
 */
function confirmDeleteAgent(agentId) {
  const agent = agentState.agents.find(a => a.id === agentId);
  if (confirm(`确定要删除 Agent "${agent?.name}" 吗？此操作不可恢复。`)) {
    window.state?.socket?.emit('delete-agent', { agentId });
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Dynamically load model options into agent preferred model select
 */
async function loadAgentModelSelect(selectedModel) {
  const select = document.getElementById('agent-preferred-model');
  if (!select) return;
  
  try {
    const response = await fetch('/api/models');
    const result = await response.json();
    if (result.success && result.models) {
      select.innerHTML = '<option value="">使用默认</option>' +
        result.models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
  } catch (e) {
    // Keep existing options on failure
  }
  
  if (selectedModel) {
    select.value = selectedModel;
  }
}

// Export functions for global access
window.agentManager = {
  init: initAgentManager,
  getCurrentAgentId,
  renderAgentSelector,
  selectAgent,
  openAgentManagement,
  closeAgentManagement,
  openCreateAgentModal,
  editAgent,
  closeAgentModal,
  saveAgent,
  setDefaultAgent,
  confirmDeleteAgent,
  showToast,
  state: agentState,
};
