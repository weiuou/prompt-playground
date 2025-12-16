import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/assets/driver-dark.css";

export const startTour = () => {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    doneBtnText: '完成',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    steps: [
      { 
        popover: { 
          title: '欢迎使用 Prompt Playground', 
          description: '这是一个强大的提示词开发和测试工具。让我们花一分钟了解主要功能。' 
        } 
      },
      { 
        element: '#tour-variable-panel', 
        popover: { 
          title: '变量面板', 
          description: '在这里定义提示词中使用的变量。支持 CSV 批量导入。' 
        } 
      },
      { 
        element: '#tour-model-selector', 
        popover: { 
          title: '模型选择', 
          description: '选择你要使用的 LLM 模型。别忘了在设置中配置 API Key。' 
        } 
      },
      { 
        element: '#tour-system-prompt', 
        popover: { 
          title: '系统提示词', 
          description: '设置 System Prompt，定义 AI 的角色和行为。' 
        } 
      },
      { 
        element: '#tour-optimizer', 
        popover: { 
          title: '提示词优化器', 
          description: '点击这里可以使用 AI 自动优化你的提示词，提高效果。' 
        } 
      },
      { 
        element: '#tour-run-btn', 
        popover: { 
          title: '运行', 
          description: '点击运行或按 Ctrl+Enter 发送请求。' 
        } 
      },
      { 
        element: '#tour-params-panel', 
        popover: { 
          title: '参数设置', 
          description: '调整 Temperature, Top P 等模型参数。' 
        } 
      },
      { 
        element: '#tour-test-cases', 
        popover: { 
          title: '测试用例', 
          description: '管理和运行批量测试用例，评估提示词效果。' 
        } 
      }
    ]
  });

  driverObj.drive();
};
