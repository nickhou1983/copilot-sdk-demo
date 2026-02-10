/**
 * Tool Manager UI Module
 * Handles tool CRUD operations and UI interactions
 */

// Tool state
const toolState = {
  builtinTools: [],
  customTools: [],
  toolGroups: [],
  editingTool: null,
};

/**
 * Initialize tool manager
 */
function initToolManager(socket) {
  // Request initial tool list
  socket.emit('list-tools');
  socket.emit('list-tool-groups');

  // Listen for tool events
  socket.on('tools-list', handleToolsList);
  socket.on('tool-groups-list', handleToolGroupsList);
  socket.on('custom-tool-created', handleCustomToolCreated);
  socket.on('custom-tool-updated', handleCustomToolUpdated);
  socket.on('custom-tool-deleted', handleCustomToolDeleted);
  socket.on('tool-group-created', handleToolGroupCreated);
  socket.on('tool-group-deleted', handleToolGroupDeleted);
}

/**
 * Handle tools list response
 */
function handleToolsList(data) {
  if (data.success) {
    toolState.builtinTools = data.builtinTools || [];
    toolState.customTools = data.customTools || [];
    renderToolSelectors();
    renderToolsList();
  } else {
    console.error('Failed to load tools:', data.error);
  }
}

/**
 * Handle tool groups list response
 */
function handleToolGroupsList(data) {
  if (data.success) {
    toolState.toolGroups = data.groups || [];
    renderToolGroupSelectors();
    renderToolGroupsList();
  } else {
    console.error('Failed to load tool groups:', data.error);
  }
}

/**
 * Handle custom tool created response
 */
function handleCustomToolCreated(data) {
  if (data.success) {
    toolState.customTools.push(data.tool);
    renderToolsList();
    renderToolSelectors();
    closeToolModal();
    window.agentManager?.showToast('工具创建成功', 'success');
  } else {
    window.agentManager?.showToast(data.error || data.errors?.join(', ') || '创建失败', 'error');
  }
}

/**
 * Handle custom tool updated response
 */
function handleCustomToolUpdated(data) {
  if (data.success) {
    const index = toolState.customTools.findIndex(t => t.id === data.tool.id);
    if (index >= 0) {
      toolState.customTools[index] = data.tool;
    }
    renderToolsList();
    renderToolSelectors();
    closeToolModal();
    window.agentManager?.showToast('工具更新成功', 'success');
  } else {
    window.agentManager?.showToast(data.error || '更新失败', 'error');
  }
}

/**
 * Handle custom tool deleted response
 */
function handleCustomToolDeleted(data) {
  if (data.success) {
    toolState.customTools = toolState.customTools.filter(t => t.id !== data.toolId);
    renderToolsList();
    renderToolSelectors();
    window.agentManager?.showToast('工具已删除', 'success');
  } else {
    window.agentManager?.showToast(data.error || '删除失败', 'error');
  }
}

/**
 * Handle tool group created response
 */
function handleToolGroupCreated(data) {
  if (data.success) {
    toolState.toolGroups.push(data.group);
    renderToolGroupsList();
    renderToolGroupSelectors();
    window.agentManager?.showToast('工具组创建成功', 'success');
  }
}

/**
 * Handle tool group deleted response
 */
function handleToolGroupDeleted(data) {
  if (data.success) {
    toolState.toolGroups = toolState.toolGroups.filter(g => g.id !== data.groupId);
    renderToolGroupsList();
    renderToolGroupSelectors();
    window.agentManager?.showToast('工具组已删除', 'success');
  }
}

/**
 * Render tool selectors in agent form
 */
function renderToolSelectors() {
  // Render builtin tools checkboxes
  const builtinContainer = document.getElementById('builtin-tools-select');
  if (builtinContainer) {
    const editingAgent = window.agentManager?.state?.editingAgent;
    builtinContainer.innerHTML = toolState.builtinTools.map(tool => `
      <label class="tool-checkbox">
        <input type="checkbox" value="${tool.id}" 
               ${editingAgent?.enabledBuiltinTools?.includes(tool.id) ? 'checked' : ''}>
        <span class="tool-label">
          <strong>${tool.name}</strong>
          <small>${tool.description}</small>
        </span>
      </label>
    `).join('');
  }

  // Render custom tools checkboxes
  const customContainer = document.getElementById('custom-tools-select');
  if (customContainer) {
    const editingAgent = window.agentManager?.state?.editingAgent;
    if (toolState.customTools.length === 0) {
      customContainer.innerHTML = '<p class="no-items">暂无自定义工具</p>';
    } else {
      customContainer.innerHTML = toolState.customTools.map(tool => `
        <label class="tool-checkbox">
          <input type="checkbox" value="${tool.id}"
                 ${editingAgent?.enabledCustomTools?.includes(tool.id) ? 'checked' : ''}>
          <span class="tool-label">
            <strong>${tool.name}</strong>
            <small>${tool.description}</small>
            <span class="tool-type-badge">${getHandlerTypeName(tool.handlerType)}</span>
          </span>
        </label>
      `).join('');
    }
  }
}

/**
 * Render tool group selectors in agent form
 */
function renderToolGroupSelectors() {
  const container = document.getElementById('tool-groups-select');
  if (!container) return;

  const editingAgent = window.agentManager?.state?.editingAgent;
  container.innerHTML = toolState.toolGroups.map(group => `
    <label class="tool-checkbox">
      <input type="checkbox" value="${group.id}"
             ${editingAgent?.toolGroupIds?.includes(group.id) ? 'checked' : ''}>
      <span class="tool-label">
        <span>${group.icon || '📦'} <strong>${group.name}</strong></span>
        <small>${group.description || `包含 ${group.toolIds?.length || 0} 个工具`}</small>
      </span>
    </label>
  `).join('');
}

/**
 * Render tools list in management tab
 */
function renderToolsList() {
  const builtinContainer = document.getElementById('builtin-tools-list');
  const customContainer = document.getElementById('custom-tools-list');

  if (builtinContainer) {
    builtinContainer.innerHTML = `
      <h4>内置工具 (${toolState.builtinTools.length})</h4>
      ${toolState.builtinTools.map(tool => `
        <div class="tool-card readonly">
          <div class="tool-card-header">
            <span class="tool-name">${tool.name}</span>
            <span class="tool-id">${tool.id}</span>
          </div>
          <p class="tool-description">${tool.description}</p>
          <div class="tool-params">
            ${tool.parameters?.map(p => `
              <span class="param-tag">${p.name}: ${p.type}${p.required ? '*' : ''}</span>
            `).join('') || '无参数'}
          </div>
        </div>
      `).join('')}
    `;
  }

  if (customContainer) {
    if (toolState.customTools.length === 0) {
      customContainer.innerHTML = `
        <h4>自定义工具 (0)</h4>
        <div class="empty-state">
          <p>暂无自定义工具</p>
          <button class="btn-primary" onclick="openCreateToolModal()">创建工具</button>
        </div>
      `;
    } else {
      customContainer.innerHTML = `
        <h4>自定义工具 (${toolState.customTools.length})</h4>
        ${toolState.customTools.map(tool => `
          <div class="tool-card ${tool.enabled ? '' : 'disabled'}">
            <div class="tool-card-header">
              <span class="tool-name">${tool.name}</span>
              <span class="tool-type-badge">${getHandlerTypeName(tool.handlerType)}</span>
            </div>
            <p class="tool-description">${tool.description}</p>
            <div class="tool-params">
              ${tool.parameters?.map(p => `
                <span class="param-tag">${p.name}: ${p.type}${p.required ? '*' : ''}</span>
              `).join('') || '无参数'}
            </div>
            <div class="tool-card-actions">
              <button class="btn-icon" onclick="toggleToolEnabled('${tool.id}')" 
                      title="${tool.enabled ? '禁用' : '启用'}">
                ${tool.enabled ? '✅' : '⏸️'}
              </button>
              <button class="btn-icon" onclick="editTool('${tool.id}')" title="编辑">✏️</button>
              <button class="btn-icon danger" onclick="confirmDeleteTool('${tool.id}')" title="删除">🗑️</button>
            </div>
          </div>
        `).join('')}
      `;
    }
  }
}

/**
 * Render tool groups list
 */
function renderToolGroupsList() {
  const container = document.getElementById('tool-groups-list');
  if (!container) return;

  if (toolState.toolGroups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无工具组</p>
        <button class="btn-secondary" onclick="openCreateToolGroupModal()">创建工具组</button>
      </div>
    `;
  } else {
    container.innerHTML = toolState.toolGroups.map(group => `
      <div class="tool-group-card">
        <div class="tool-group-header">
          <span class="group-icon">${group.icon || '📦'}</span>
          <div class="group-info">
            <h4>${group.name}</h4>
            <p>${group.description || '暂无描述'}</p>
          </div>
        </div>
        <div class="group-tools">
          包含工具: ${group.toolIds?.join(', ') || '无'}
        </div>
        <div class="tool-card-actions">
          <button class="btn-icon danger" onclick="confirmDeleteToolGroup('${group.id}')" title="删除">🗑️</button>
        </div>
      </div>
    `).join('');
  }
}

/**
 * Get handler type display name
 */
function getHandlerTypeName(type) {
  const names = {
    'http_get': 'HTTP GET',
    'http_post': 'HTTP POST',
    'javascript': 'JavaScript',
  };
  return names[type] || type;
}

/**
 * Open create tool modal
 */
function openCreateToolModal() {
  toolState.editingTool = null;
  resetToolForm();
  document.getElementById('tool-modal-title').textContent = '创建自定义工具';
  document.getElementById('tool-modal').classList.add('show');
}

/**
 * Edit existing tool
 */
function editTool(toolId) {
  const tool = toolState.customTools.find(t => t.id === toolId);
  if (!tool) return;

  toolState.editingTool = tool;

  document.getElementById('tool-name').value = tool.name;
  document.getElementById('tool-description').value = tool.description;
  document.getElementById('tool-handler-type').value = tool.handlerType;
  document.getElementById('tool-parameters').value = JSON.stringify(tool.parameters, null, 2);

  // Set handler config based on type
  updateHandlerConfigUI(tool.handlerType);
  if (tool.handlerType === 'http_get' || tool.handlerType === 'http_post') {
    document.getElementById('tool-url').value = tool.handlerConfig.url || '';
    document.getElementById('tool-headers').value = JSON.stringify(tool.handlerConfig.headers || {}, null, 2);
    if (tool.handlerType === 'http_post') {
      document.getElementById('tool-body-template').value = tool.handlerConfig.bodyTemplate || '';
    }
    document.getElementById('tool-result-path').value = tool.handlerConfig.resultPath || '';
  } else if (tool.handlerType === 'javascript') {
    document.getElementById('tool-js-code').value = tool.handlerConfig.code || '';
  }

  document.getElementById('tool-modal-title').textContent = '编辑工具';
  document.getElementById('tool-modal').classList.add('show');
}

/**
 * Reset tool form
 */
function resetToolForm() {
  document.getElementById('tool-name').value = '';
  document.getElementById('tool-description').value = '';
  document.getElementById('tool-handler-type').value = 'http_get';
  document.getElementById('tool-parameters').value = '[]';
  document.getElementById('tool-url').value = '';
  document.getElementById('tool-headers').value = '{}';
  document.getElementById('tool-body-template').value = '';
  document.getElementById('tool-result-path').value = '';
  document.getElementById('tool-js-code').value = '';
  updateHandlerConfigUI('http_get');
}

/**
 * Update handler config UI based on type
 */
function updateHandlerConfigUI(type) {
  const httpConfig = document.getElementById('http-handler-config');
  const jsConfig = document.getElementById('js-handler-config');
  const bodyTemplateGroup = document.getElementById('body-template-group');

  if (type === 'http_get' || type === 'http_post') {
    httpConfig.style.display = 'block';
    jsConfig.style.display = 'none';
    bodyTemplateGroup.style.display = type === 'http_post' ? 'block' : 'none';
  } else if (type === 'javascript') {
    httpConfig.style.display = 'none';
    jsConfig.style.display = 'block';
  }
}

/**
 * Close tool modal
 */
function closeToolModal() {
  document.getElementById('tool-modal').classList.remove('show');
  toolState.editingTool = null;
}

/**
 * Save tool (create or update)
 */
function saveTool() {
  const name = document.getElementById('tool-name').value.trim();
  const description = document.getElementById('tool-description').value.trim();
  const handlerType = document.getElementById('tool-handler-type').value;

  let parameters;
  try {
    parameters = JSON.parse(document.getElementById('tool-parameters').value);
  } catch (e) {
    window.agentManager?.showToast('参数格式错误，请输入有效的 JSON', 'error');
    return;
  }

  let handlerConfig;
  if (handlerType === 'http_get' || handlerType === 'http_post') {
    let headers;
    try {
      headers = JSON.parse(document.getElementById('tool-headers').value || '{}');
    } catch (e) {
      window.agentManager?.showToast('Headers 格式错误', 'error');
      return;
    }

    handlerConfig = {
      url: document.getElementById('tool-url').value.trim(),
      headers: headers,
      resultPath: document.getElementById('tool-result-path').value.trim() || undefined,
    };

    if (handlerType === 'http_post') {
      handlerConfig.bodyTemplate = document.getElementById('tool-body-template').value || undefined;
    }
  } else if (handlerType === 'javascript') {
    handlerConfig = {
      code: document.getElementById('tool-js-code').value,
    };
  }

  if (!name) {
    window.agentManager?.showToast('请输入工具名称', 'error');
    return;
  }

  const data = {
    name,
    description,
    parameters,
    handlerType,
    handlerConfig,
  };

  if (toolState.editingTool) {
    window.state?.socket?.emit('update-custom-tool', {
      id: toolState.editingTool.id,
      ...data,
    });
  } else {
    window.state?.socket?.emit('create-custom-tool', data);
  }
}

/**
 * Toggle tool enabled state
 */
function toggleToolEnabled(toolId) {
  const tool = toolState.customTools.find(t => t.id === toolId);
  if (tool) {
    window.state?.socket?.emit('update-custom-tool', {
      id: toolId,
      enabled: !tool.enabled,
    });
  }
}

/**
 * Confirm and delete tool
 */
function confirmDeleteTool(toolId) {
  const tool = toolState.customTools.find(t => t.id === toolId);
  if (confirm(`确定要删除工具 "${tool?.name}" 吗？此操作不可恢复。`)) {
    window.state?.socket?.emit('delete-custom-tool', { toolId });
  }
}

/**
 * Open create tool group modal
 */
function openCreateToolGroupModal() {
  // Simple prompt for now
  const name = prompt('请输入工具组名称:');
  if (name?.trim()) {
    window.state?.socket?.emit('create-tool-group', {
      name: name.trim(),
      description: '',
      toolIds: [],
    });
  }
}

/**
 * Confirm and delete tool group
 */
function confirmDeleteToolGroup(groupId) {
  const group = toolState.toolGroups.find(g => g.id === groupId);
  if (confirm(`确定要删除工具组 "${group?.name}" 吗？`)) {
    window.state?.socket?.emit('delete-tool-group', { groupId });
  }
}

/**
 * Toggle result config fields visibility
 */
function toggleResultConfig(checked) {
  const group = document.getElementById('tool-result-config-group');
  if (group) {
    group.style.display = checked ? 'block' : 'none';
  }
}

// Export functions for global access
window.toolManager = {
  init: initToolManager,
  renderToolSelectors,
  renderToolGroupSelectors,
  openCreateToolModal,
  editTool,
  closeToolModal,
  saveTool,
  toggleToolEnabled,
  confirmDeleteTool,
  openCreateToolGroupModal,
  confirmDeleteToolGroup,
  updateHandlerConfigUI,
  toggleResultConfig,
  state: toolState,
};
