// dsh-vk-contract — 3栏layout 生态契约（运行真源，唯一）。
// 命名：包名 dsh-vk-<name>，槽名 vk.<area>.<name>，常量 UPPER_SNAKE，函数 camelCase，组件 PascalCase。
// 扩展：投内容用 vkCard(ctx,{slot,id,order,component})；新增栏目只加一行 VK_SLOT_TABLE，不改骨架。
window.__ModuleLoader__.load({
  id: 'dsh-vk-contract',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    /* ── 槽名常量 ─────────────────────────────────────────────── */
    const VK = {
      sidebar: {
        files: 'vk.sidebar.files',
        sessions: 'vk.sidebar.sessions',
        tasks: 'vk.sidebar.tasks',
        extensions: 'vk.sidebar.extensions',
        footer: 'vk.sidebar.footer',
        dirflow: 'vk.sidebar.dirflow'
      },
      rightbar: {
        viewer: 'vk.rightbar.viewer',
        files: 'vk.rightbar.files',
        tools: 'vk.rightbar.tools'
      },
      bottom: {
        cmdstrip: 'vk.bottom.cmdstrip'
      },
      settings: {
        persona: 'vk.settings.persona',
        skills: 'vk.settings.skills',
        mcp: 'vk.settings.mcp',
      },
      input: {
        left: 'vk.input.left',
        right: 'vk.input.right'
      },
      session: {
        headerLeft: 'vk.session.header.left',
        headerRight: 'vk.session.header.right'
      },
      overlay: 'vk.overlay',
      statusbar: {
        left: 'vk.statusbar.left',
        right: 'vk.statusbar.right'
      }
    };

    /* ── 区域 ─────────────────────────────────────────────────── */
    const VK_AREAS = ['sidebar', 'rightbar', 'bottom', 'settings', 'input', 'session', 'overlay', 'statusbar'];

    /* ── 槽位总表（唯一真源）────────────────────────────────────
     * area      区域
     * id        栏目 id（pane 必填）
     * slot      槽名
     * kind      list | single
     * scope     root | session
     * pane      是否标签页组成员
     * label     标签文字（pane 必填）
     * order     区域内顺序（pane 必填）
     * provider  预期投递方；null = 预留
     * mirror    true = 该槽由镜像条目声明，区域宿主不得重复声明（声明是排他的，重复会 already declared）
     * legacy    旧槽名，仅供迁移对照
     * ──────────────────────────────────────────────────────── */
    const VK_SLOT_TABLE = [
      // 左栏
      { area: 'sidebar', id: 'sessions', slot: VK.sidebar.sessions, kind: 'single', scope: 'root', pane: true, label: '会话', order: 10, provider: 'dsh-vk-layout', legacy: ['vk.sidebar.browser', 'sidebar.workspaces(官方)'] },
      { area: 'sidebar', id: 'files', slot: VK.sidebar.files, kind: 'list', scope: 'root', pane: true, label: '文件', order: 20, provider: 'dsh-vk-files', legacy: ['sidebar.workspaces(自研抢占)'] },
      { area: 'sidebar', id: 'tasks', slot: VK.sidebar.tasks, kind: 'single', scope: 'root', pane: true, label: '任务', order: 30, provider: 'dsh-lt-tasks', legacy: ['sidebar.tasks'] },
      { area: 'sidebar', id: 'extensions', slot: VK.sidebar.extensions, kind: 'list', scope: 'root', pane: true, label: '功能', order: 40, provider: 'dsh-extensions-panel / dsh-lan-services', legacy: ['sidebar.extensions'] },
      // 右栏
      { area: 'rightbar', id: 'viewer', slot: VK.rightbar.viewer, kind: 'list', scope: 'session', pane: true, label: '查看器', order: 10, provider: 'dsh-vk-viewer', legacy: ['sidebar.right.pane.tab(key=view)'] },
      { area: 'rightbar', id: 'files', slot: VK.rightbar.files, kind: 'list', scope: 'session', pane: true, label: '打开本机文件', order: 20, provider: 'dsh-vk-files', legacy: ['sidebar.right.pane.tab(key=pick)'] },
      { area: 'rightbar', id: 'tools', slot: VK.rightbar.tools, kind: 'list', scope: 'session', pane: true, label: '工具', order: 30, provider: null, legacy: [] },
      // 底部
      { area: 'bottom', id: 'cmdstrip', slot: VK.bottom.cmdstrip, kind: 'list', scope: 'root', pane: true, label: '命令行', order: 10, provider: 'dsh-vk-cmdstrip (DOM 宿主，不走槽)', legacy: ['data-vk-cmd-*(DOM 宿主)'] },
      // 设置页
      { area: 'settings', id: 'persona', slot: VK.settings.persona, kind: 'list', scope: 'root', pane: true, label: '全局人设', order: 10, provider: 'dsh-vk-settings', legacy: ['settings.section(id=persona)'] },
      { area: 'settings', id: 'skills', slot: VK.settings.skills, kind: 'list', scope: 'root', pane: true, label: 'Skill 管理', order: 20, provider: 'dsh-vk-settings', legacy: ['settings.section(id=skills)'] },
      { area: 'settings', id: 'mcp', slot: VK.settings.mcp, kind: 'list', scope: 'root', pane: true, label: 'MCP 管理', order: 30, provider: 'dsh-vk-settings', legacy: ['settings.section(id=mcp)'] },
      // 固定位置
      { area: 'sidebar', id: null, slot: VK.sidebar.footer, kind: 'list', scope: 'root', pane: false, label: null, order: null, provider: 'dsh-wallet / dsh-archive-button', legacy: ['sidebar.footer.action'] },
      { area: 'sidebar', id: null, slot: VK.sidebar.dirflow, kind: 'single', scope: 'root', pane: false, label: null, order: null, provider: 'dsh-vk-layout', mirror: true, legacy: ['sidebar.workspaces.directoryFlow(官方)'] },
      { area: 'input', id: null, slot: VK.input.left, kind: 'single', scope: 'session', pane: false, label: null, order: null, provider: null, legacy: ['conversation.input.left(官方槽承载 composer 搜索按钮)'] },
      { area: 'input', id: null, slot: VK.input.right, kind: 'list', scope: 'session', pane: false, label: null, order: null, provider: 'dsh-skill-sets', legacy: ['conversation.input.dock(官方：输入框上方整宽一行 / list)'] },
      { area: 'session', id: null, slot: VK.session.headerLeft, kind: 'list', scope: 'session', pane: false, label: null, order: null, provider: null, legacy: ['conversation.session.header.actions'] },
      { area: 'session', id: null, slot: VK.session.headerRight, kind: 'list', scope: 'session', pane: false, label: null, order: null, provider: 'dsh-vk-terminal', legacy: ['conversation.session.header.utilities', 'conversation.session.header.corner'] },
      { area: 'overlay', id: null, slot: VK.overlay, kind: 'list', scope: 'root', pane: false, label: null, order: null, provider: null, legacy: ['shell.overlay'] },
      { area: 'statusbar', id: null, slot: VK.statusbar.left, kind: 'list', scope: 'root', pane: false, label: null, order: null, provider: null, legacy: [] },
      { area: 'statusbar', id: null, slot: VK.statusbar.right, kind: 'list', scope: 'root', pane: false, label: null, order: null, provider: null, legacy: [] }
    ];

    /* ── 派生视图 ─────────────────────────────────────────────── */
    const VK_PANES = VK_AREAS.reduce((acc, area) => {
      acc[area] = VK_SLOT_TABLE
        .filter((s) => s.area === area && s.pane === true)
        .map((s) => ({ slot: s.slot, id: s.id, label: s.label, order: s.order, provider: s.provider }))
        .sort((a, b) => a.order - b.order);
      return acc;
    }, {});

    const VK_SEATS = VK_AREAS.reduce((acc, area) => {
      acc[area] = VK_SLOT_TABLE
        .filter((s) => s.area === area && s.pane === false)
        .sort((a, b) => String(a.slot).localeCompare(String(b.slot)));
      return acc;
    }, {});

    const VK_ALL_SLOTS = VK_SLOT_TABLE.map((s) => s.slot);
    const VK_PANE_SLOTS = VK_SLOT_TABLE.filter((s) => s.pane).map((s) => s.slot);

    function vkSlotsOf(area) {
      return VK_SLOT_TABLE.filter((s) => s.area === area);
    }

    function vkSlotOf(slot) {
      return VK_SLOT_TABLE.find((s) => s.slot === slot) || null;
    }

    /* ── 中立服务名 ───────────────────────────────────────────── */
    const VK_SERVICE = {
      LAYOUT: 'vkLayout',
      OPEN_FILE: 'vkOpenFile',
      PANES: 'vkPanes'
    };

    /* ── 唯一内容注册 API ─────────────────────────────────────── */
    /**
     * 往已登记槽投递内容。写法对文件栏 / 任务栏 / 功能栏完全一致。
     * @param {object} ctx 客户端插件上下文（含 slots 服务）
     * @param {{slot:string,id:string,order?:number,label?:string|Function,component:Function}} spec
     * @returns {() => void} 幂等 disposer
     */
    function vkCard(ctx, spec) {
      const { slot, id, order = 100, label = null, component } = spec;
      if (!slot || !id || typeof component !== 'function') {
        throw new Error('[vk-contract] vkCard 需要 slot / id / component');
      }
      const options = { name: slot, id, order };
      if (label !== null) options.label = label;
      return ctx.slots.inject(slot, () => ctx.slots.register(options, component));
    }

    /**
     * 读某槽当前条目（空态提示与诊断用）。
     * @param {object} ctx
     * @param {string} slot
     * @returns {readonly object[]}
     */
    function vkEntries(ctx, slot) {
      try {
        const list = ctx.slots.entries(slot);
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    }

    /* ── 导出 ─────────────────────────────────────────────────── */
    exports.VK = VK;
    exports.VK_AREAS = VK_AREAS;
    exports.VK_SLOT_TABLE = VK_SLOT_TABLE;
    exports.VK_PANES = VK_PANES;
    exports.VK_SEATS = VK_SEATS;
    exports.VK_ALL_SLOTS = VK_ALL_SLOTS;
    exports.VK_PANE_SLOTS = VK_PANE_SLOTS;
    exports.VK_SERVICE = VK_SERVICE;
    exports.vkSlotsOf = vkSlotsOf;
    exports.vkSlotOf = vkSlotOf;
    exports.vkCard = vkCard;
    exports.vkEntries = vkEntries;

    // 本插件只提供契约，无运行时行为。
    exports.inject = [];
    exports.apply = function apply() {};

    return module.exports;
  }
});
