/**
 * MCP Server Manager - 前端管理模块
 * 处理 MCP 服务器的 CRUD 和 UI 交互
 */

class MCPManager {
  constructor(socket) {
    this.socket = socket;
    this.servers = [];
    this.editingServerId = null;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('mcp-servers-list', (data) => {
      if (data.success) {
        this.servers = data.servers;
        this.renderServerList();
      }
    });

    this.socket.on('mcp-server-created', (data) => {
      if (data.success) {
        this.servers.push(data.server);
        this.renderServerList();
        this.closeMCPModal();
        this.showToast('MCP 服务器创建成功', 'success');
      } else {
        this.showToast(data.error || '创建失败', 'error');
      }
    });

    this.socket.on('mcp-server-updated', (data) => {
      if (data.success) {
        const idx = this.servers.findIndex(s => s.id === data.server.id);
        if (idx >= 0) this.servers[idx] = data.server;
        this.renderServerList();
        this.closeMCPModal();
        this.showToast('MCP 服务器更新成功', 'success');
      } else {
        this.showToast(data.error || '更新失败', 'error');
      }
    });

    this.socket.on('mcp-server-deleted', (data) => {
      if (data.success) {
        this.servers = this.servers.filter(s => s.id !== data.serverId);
        this.renderServerList();
        this.showToast('MCP 服务器已删除', 'success');
      }
    });

    this.socket.on('mcp-server-toggled', (data) => {
      if (data.success) {
        const idx = this.servers.findIndex(s => s.id === data.server.id);
        if (idx >= 0) this.servers[idx] = data.server;
        this.renderServerList();
      }
    });
  }

  loadServers() {
    this.socket.emit('list-mcp-servers');
  }

  renderServerList() {
    const container = document.getElementById('mcp-server-list');
    if (!container) return;

    if (this.servers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔌</span>
          <p>尚未配置 MCP 服务器</p>
          <p class="empty-hint">点击上方"添加 MCP 服务器"按钮开始配置</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.servers.map(server => `
      <div class="mcp-server-card ${server.enabled ? '' : 'disabled'}" data-server-id="${server.id}">
        <div class="mcp-server-header">
          <div class="mcp-server-info">
            <span class="mcp-server-type-badge ${server.type}">${server.type.toUpperCase()}</span>
            <span class="mcp-server-name">${this.escapeHtml(server.name)}</span>
            <span class="mcp-server-scope ${server.scope}">${server.scope === 'global' ? '全局' : 'Agent'}</span>
          </div>
          <div class="mcp-server-actions">
            <label class="toggle-switch" title="${server.enabled ? '禁用' : '启用'}">
              <input type="checkbox" ${server.enabled ? 'checked' : ''} onchange="mcpManager.toggleServer('${server.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <button class="btn-icon" onclick="mcpManager.editServer('${server.id}')" title="编辑">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.098a.25.25 0 00-.064.108l-.631 2.208 2.208-.63a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.355l-1.086-1.086z"></path></svg>
            </button>
            <button class="btn-icon danger" onclick="mcpManager.deleteServer('${server.id}')" title="删除">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zM11 3V1.75A1.75 1.75 0 009.25 0h-2.5A1.75 1.75 0 005 1.75V3H2.75a.75.75 0 000 1.5h.928l.442 8.602A1.75 1.75 0 005.87 14.5h4.26c.92 0 1.685-.722 1.75-1.638L12.322 4.5h.928a.75.75 0 000-1.5H11z"></path></svg>
            </button>
          </div>
        </div>
        <div class="mcp-server-detail">
          ${server.type === 'local' || server.type === 'stdio'
            ? `<code>${this.escapeHtml(server.command || '')} ${(server.args || []).join(' ')}</code>`
            : `<code>${this.escapeHtml(server.url || '')}</code>`
          }
        </div>
      </div>
    `).join('');
  }

  openCreateModal() {
    this.editingServerId = null;
    const modal = document.getElementById('mcp-modal');
    if (!modal) return;

    document.getElementById('mcp-modal-title').textContent = '添加 MCP 服务器';
    document.getElementById('mcp-server-name-input').value = '';
    document.getElementById('mcp-server-type-select').value = 'local';
    document.getElementById('mcp-server-command-input').value = '';
    document.getElementById('mcp-server-args-input').value = '';
    document.getElementById('mcp-server-url-input').value = '';
    document.getElementById('mcp-server-scope-select').value = 'global';
    this.toggleTypeFields('local');
    modal.style.display = 'flex';
  }

  editServer(serverId) {
    const server = this.servers.find(s => s.id === serverId);
    if (!server) return;

    this.editingServerId = serverId;
    const modal = document.getElementById('mcp-modal');
    if (!modal) return;

    document.getElementById('mcp-modal-title').textContent = '编辑 MCP 服务器';
    document.getElementById('mcp-server-name-input').value = server.name;
    document.getElementById('mcp-server-type-select').value = server.type;
    document.getElementById('mcp-server-command-input').value = server.command || '';
    document.getElementById('mcp-server-args-input').value = (server.args || []).join(' ');
    document.getElementById('mcp-server-url-input').value = server.url || '';
    document.getElementById('mcp-server-scope-select').value = server.scope || 'global';
    this.toggleTypeFields(server.type);
    modal.style.display = 'flex';
  }

  toggleTypeFields(type) {
    const localFields = document.getElementById('mcp-local-fields');
    const remoteFields = document.getElementById('mcp-remote-fields');
    if (localFields) localFields.style.display = (type === 'local' || type === 'stdio') ? 'block' : 'none';
    if (remoteFields) remoteFields.style.display = (type === 'http' || type === 'sse') ? 'block' : 'none';
  }

  saveServer() {
    const name = document.getElementById('mcp-server-name-input').value.trim();
    const type = document.getElementById('mcp-server-type-select').value;
    const command = document.getElementById('mcp-server-command-input').value.trim();
    const argsStr = document.getElementById('mcp-server-args-input').value.trim();
    const url = document.getElementById('mcp-server-url-input').value.trim();
    const scope = document.getElementById('mcp-server-scope-select').value;

    if (!name) {
      this.showToast('请输入服务器名称', 'error');
      return;
    }

    const data = {
      name,
      type,
      scope,
    };

    if (type === 'local' || type === 'stdio') {
      if (!command) {
        this.showToast('请输入命令', 'error');
        return;
      }
      data.command = command;
      data.args = argsStr ? argsStr.split(/\s+/) : [];
    } else {
      if (!url) {
        this.showToast('请输入 URL', 'error');
        return;
      }
      data.url = url;
    }

    if (this.editingServerId) {
      data.id = this.editingServerId;
      this.socket.emit('update-mcp-server', data);
    } else {
      this.socket.emit('create-mcp-server', data);
    }
  }

  deleteServer(serverId) {
    if (confirm('确定要删除此 MCP 服务器配置吗？')) {
      this.socket.emit('delete-mcp-server', { serverId });
    }
  }

  toggleServer(serverId, enabled) {
    this.socket.emit('toggle-mcp-server', { serverId, enabled });
  }

  closeMCPModal() {
    const modal = document.getElementById('mcp-modal');
    if (modal) modal.style.display = 'none';
    this.editingServerId = null;
  }

  showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getServers() {
    return this.servers;
  }
}

// 全局实例（由 app.js 初始化）
let mcpManager = null;
