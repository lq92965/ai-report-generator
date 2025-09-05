document.addEventListener("DOMContentLoaded", () => {
  const generateButton = document.getElementById('generateButton');
  const reportTextArea = document.getElementById('reportText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const copyButton = document.getElementById('copyButton');
  const toast = document.getElementById('toast');
  
  let reportText = '';

  // 生成报告
  generateButton.addEventListener('click', async () => {
    loadingSpinner.style.display = 'block'; // 显示加载动画
    generateButton.disabled = true; // 禁用按钮

    // 模拟生成报告过程
    setTimeout(() => {
      reportText = '这是生成的日报内容...';
      reportTextArea.value = reportText;
      loadingSpinner.style.display = 'none'; // 隐藏加载动画
      generateButton.disabled = false; // 启用按钮
    }, 2000);
  });

  // 复制结果
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(reportText).then(() => {
      toast.style.display = 'block'; // 显示 Toast
      setTimeout(() => toast.style.display = 'none', 2000); // 隐藏 Toast
    });
  });
});
