# Prompt Playground

<div align="center">

![Vue.js](https://img.shields.io/badge/vuejs-%2335495e.svg?style=for-the-badge&logo=vuedotjs&logoColor=%234FC08D)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![Naive UI](https://img.shields.io/badge/Naive%20UI-529b2e?style=for-the-badge&logo=naiveui&logoColor=white)
![Pinia](https://img.shields.io/badge/Pinia-ffd859?style=for-the-badge&logo=pinia&logoColor=black)

**Prompt Playground** 是一个用于开发、调试和自动优化 LLM 提示词（Prompt）的项目。它集成了 Prompt 编写、变量管理、自动化测试评估以及 AI 驱动的 Prompt 优化功能。

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [项目截图](#-项目截图) • [贡献](#-贡献)

</div>

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=weiuou/prompt-playground&type=date&legend=top-left)](https://www.star-history.com/#weiuou/prompt-playground&type=date&legend=top-left)

## ✨ 功能特性

- **自动优化 (Auto-Optimizer)**
  - 基于遗传算法或迭代反馈的 Prompt 自动优化
  - 智能分析失败案例，自动调整 Prompt 措辞
  - 支持多轮迭代，实时查看分数变化曲线

- **多维评估 (Evaluation System)**
  - **规则评估**：包含/不包含特定关键词
  - **AI 裁判**：使用 LLM 作为裁判，支持自定义评分标准 (Rubric)
  - **代码评估**：支持编写 JS 代码进行复杂的逻辑校验
  - **人工审核**：人工介入评分

- **强大的编辑器**
  - 变量管理面板：实时查看和编辑 Prompt 变量
  - 版本控制：基于 Dexie (IndexedDB) 的本地历史记录
  - 实时预览：所见即所得的 Prompt 渲染

- **可视化分析**
  - 集成 ECharts 展示优化过程的分数趋势
  - 详细的 Diff 对比，展示 Prompt 修改前后的差异

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm 或 pnpm

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/weiuou/prompt-playground.git
cd prompt-playground
```

2. **安装依赖**

```bash
cd app
npm install
# 或者使用 pnpm
pnpm install
```

3. **启动开发服务器**

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可开始使用。

## 目录结构

```
prompt-playground/
├── app/
│   ├── src/
│   │   ├── components/    # Vue 组件 (Editor, Optimizer, etc.)
│   │   ├── services/      # 核心业务逻辑 (Optimizer, Evaluator, LLM Client)
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── views/         # 页面视图
│   │   └── App.vue
│   └── package.json
└── README.md
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 新建 Feat_xxx 分支
3. 提交代码
4. 新建 Pull Request

## 许可证

[MIT License](LICENSE)
