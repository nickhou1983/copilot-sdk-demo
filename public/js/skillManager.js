/**
 * Skills Manager - Frontend module
 * Handles skill CRUD and UI interactions via Socket.io
 */

class SkillManager {
  constructor(socket) {
    this.socket = socket;
    this.skills = [];
    this.directories = [];
    this.editingSkillId = null;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('skills-list', (data) => {
      if (data.success) {
        this.skills = data.skills;
        this.renderSkillsList();
      }
    });

    this.socket.on('skill-created', (data) => {
      if (data.success) {
        this.skills.push(data.skill);
        this.renderSkillsList();
        this.closeModal();
        this.showToast('Skill 创建成功', 'success');
      } else {
        this.showToast(data.error || '创建失败', 'error');
      }
    });

    this.socket.on('skill-updated', (data) => {
      if (data.success) {
        const idx = this.skills.findIndex(s => s.id === data.skill.id);
        if (idx >= 0) this.skills[idx] = data.skill;
        this.renderSkillsList();
        this.closeModal();
        this.showToast('Skill 更新成功', 'success');
      } else {
        this.showToast(data.error || '更新失败', 'error');
      }
    });

    this.socket.on('skill-deleted', (data) => {
      if (data.success) {
        this.skills = this.skills.filter(s => s.id !== data.skillId);
        this.renderSkillsList();
        this.showToast('Skill 已删除', 'success');
      }
    });

    this.socket.on('skill-toggled', (data) => {
      if (data.success) {
        // Reload skills to get updated enabled states
        this.loadSkills();
      }
    });

    this.socket.on('skill-directories-list', (data) => {
      if (data.success) {
        this.directories = data.directories;
        this.renderDirectories();
      }
    });

    this.socket.on('skill-directory-added', (data) => {
      if (data.success) {
        this.directories = data.config.directories;
        this.renderDirectories();
        this.showToast('目录已添加', 'success');
        document.getElementById('new-skill-dir').value = '';
      } else {
        this.showToast(data.error || '添加目录失败', 'error');
      }
    });

    this.socket.on('skill-directory-removed', (data) => {
      if (data.success) {
        this.directories = data.config.directories;
        this.renderDirectories();
        this.showToast('目录已移除', 'success');
      }
    });
  }

  loadSkills() {
    this.socket.emit('list-skills');
    this.socket.emit('list-skill-directories');
  }

  renderSkillsList() {
    const container = document.getElementById('skills-list');
    if (!container) return;

    if (this.skills.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <p>尚未创建 Skill</p>
          <p class="empty-hint">Skill 是 Markdown 文件，用于定义特定领域的知识和指令</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.skills.map(skill => `
      <div class="skill-card ${skill.enabled ? '' : 'disabled'}">
        <div class="skill-header">
          <div class="skill-info">
            <span class="skill-name">${this.escapeHtml(skill.name)}</span>
            <span class="skill-desc">${this.escapeHtml(skill.description)}</span>
          </div>
          <div class="skill-actions">
            <label class="toggle-switch" title="${skill.enabled ? '禁用' : '启用'}">
              <input type="checkbox" ${skill.enabled ? 'checked' : ''} onchange="skillManager.toggleSkill('${this.escapeHtml(skill.name)}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <button class="btn-icon" onclick="skillManager.editSkill('${skill.id}')" title="编辑">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.098a.25.25 0 00-.064.108l-.631 2.208 2.208-.63a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.355l-1.086-1.086z"></path></svg>
            </button>
            <button class="btn-icon danger" onclick="skillManager.deleteSkill('${skill.id}')" title="删除">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zM11 3V1.75A1.75 1.75 0 009.25 0h-2.5A1.75 1.75 0 005 1.75V3H2.75a.75.75 0 000 1.5h.928l.442 8.602A1.75 1.75 0 005.87 14.5h4.26c.92 0 1.685-.722 1.75-1.638L12.322 4.5h.928a.75.75 0 000-1.5H11z"></path></svg>
            </button>
          </div>
        </div>
        <div class="skill-meta">
          <span>${this.escapeHtml(skill.filename)}</span>
        </div>
      </div>
    `).join('');
  }

  renderDirectories() {
    const container = document.getElementById('skill-directories-list');
    if (!container) return;

    if (this.directories.length === 0) {
      container.innerHTML = '<p class="empty-hint">暂无 Skill 目录</p>';
      return;
    }

    container.innerHTML = this.directories.map(dir => `
      <div class="skill-dir-item">
        <code>${this.escapeHtml(dir)}</code>
        <button class="btn-icon danger" onclick="skillManager.removeDirectory('${this.escapeHtml(dir)}')" title="移除">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"></path></svg>
        </button>
      </div>
    `).join('');
  }

  openCreateModal() {
    this.editingSkillId = null;
    document.getElementById('skill-modal-title').textContent = '创建 Skill';
    document.getElementById('skill-name-input').value = '';
    document.getElementById('skill-content-input').value = '';
    document.getElementById('skill-modal').style.display = 'flex';
    document.getElementById('skill-modal').classList.add('show');
  }

  editSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    this.editingSkillId = skillId;
    document.getElementById('skill-modal-title').textContent = '编辑 Skill';
    document.getElementById('skill-name-input').value = skill.name;
    document.getElementById('skill-content-input').value = skill.content || '';
    document.getElementById('skill-modal').classList.add('show');
  }

  saveSkill() {
    const name = document.getElementById('skill-name-input').value.trim();
    const content = document.getElementById('skill-content-input').value;

    if (!name) {
      this.showToast('请输入 Skill 名称', 'error');
      return;
    }

    if (!content.trim()) {
      this.showToast('请输入 Skill 内容', 'error');
      return;
    }

    if (this.editingSkillId) {
      this.socket.emit('update-skill', { skillId: this.editingSkillId, content });
    } else {
      this.socket.emit('create-skill', { name, content });
    }
  }

  deleteSkill(skillId) {
    if (confirm('确定要删除此 Skill 吗？')) {
      this.socket.emit('delete-skill', { skillId });
    }
  }

  toggleSkill(skillName, enabled) {
    this.socket.emit('toggle-skill', { skillName, enabled });
  }

  addDirectory() {
    const input = document.getElementById('new-skill-dir');
    const dir = input.value.trim();
    if (!dir) {
      this.showToast('请输入目录路径', 'error');
      return;
    }
    this.socket.emit('add-skill-directory', { directory: dir });
  }

  removeDirectory(dir) {
    if (confirm(`确定要移除目录 "${dir}" 吗？（目录中的文件不会被删除）`)) {
      this.socket.emit('remove-skill-directory', { directory: dir });
    }
  }

  closeModal() {
    const modal = document.getElementById('skill-modal');
    if (modal) modal.classList.remove('show');
    this.editingSkillId = null;
  }

  showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else if (window.agentManager?.showToast) {
      window.agentManager.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance (initialized by app.js)
let skillManager = null;
