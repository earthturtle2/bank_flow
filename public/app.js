// 全局变量
let banks = [];
let currentTask = null;
let selectedRoute = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadBanks();
    loadTasks();
});

// 显示标签页
function showTab(tabName) {
    // 隐藏所有标签页内容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有标签的激活状态
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 显示选中的标签页
    document.getElementById(tabName).classList.add('active');
    
    // 激活对应的标签
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.textContent.includes(getTabTitle(tabName))) {
            tab.classList.add('active');
        }
    });
    
    // 特殊处理
    if (tabName === 'manage') {
        loadTaskManagement();
    } else if (tabName === 'tasks') {
        loadTasks();
    }
}

function getTabTitle(tabName) {
    const titles = {
        'create': '创建转账',
        'manage': '管理任务',
        'tasks': '任务列表'
    };
    return titles[tabName] || tabName;
}

// 加载银行列表
async function loadBanks() {
    try {
        const response = await fetch('/api/banks');
        const result = await response.json();
        
        if (result.success) {
            banks = result.data;
            populateBankSelects();
        } else {
            showAlert('加载银行列表失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 填充银行选择框
function populateBankSelects() {
    const fromBankSelect = document.getElementById('fromBank');
    const toBankSelect = document.getElementById('toBank');
    
    // 清空现有选项（保留第一个提示选项）
    while (fromBankSelect.children.length > 1) {
        fromBankSelect.removeChild(fromBankSelect.lastChild);
    }
    while (toBankSelect.children.length > 1) {
        toBankSelect.removeChild(toBankSelect.lastChild);
    }
    
    // 添加银行选项 - 现在banks是对象格式，需要转换为数组
    const bankArray = Object.values(banks);
    bankArray.forEach(bank => {
        const option1 = document.createElement('option');
        option1.value = bank.id;
        option1.textContent = bank.name;
        fromBankSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = bank.id;
        option2.textContent = bank.name;
        toBankSelect.appendChild(option2);
    });
}

// 查找可用路线
async function findRoutes() {
    const currency = document.getElementById('currency').value;
    const amount = document.getElementById('amount').value;
    const fromBankId = document.getElementById('fromBank').value;
    const toBankId = document.getElementById('toBank').value;
    
    // 验证输入
    if (!currency || !amount || !fromBankId || !toBankId) {
        showAlert('请填写所有必填字段', 'error');
        return;
    }
    
    if (fromBankId === toBankId) {
        showAlert('发款银行和收款银行不能相同', 'error');
        return;
    }
    
    try {
        showAlert('正在查找可用路线...', 'success');
        
        const response = await fetch(`/api/routes?currency=${currency}&amount=${amount}&fromBankId=${fromBankId}&toBankId=${toBankId}`);
        const result = await response.json();
        
        if (result.success) {
            displayRoutes(result.data);
        } else {
            showAlert('查找路线失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 显示可用路线
function displayRoutes(routes) {
    const routesList = document.getElementById('routesList');
    const routesSection = document.getElementById('routesSection');
    
    routesList.innerHTML = '';
    
    if (routes.length === 0) {
        routesList.innerHTML = '<div class="alert alert-error">没有找到可用的转账路线</div>';
        routesSection.classList.remove('hidden');
        return;
    }
    
    routes.forEach((route, index) => {
        const routeElement = document.createElement('div');
        routeElement.className = 'route-option';
        routeElement.onclick = () => selectRoute(route, routeElement);
        
        routeElement.innerHTML = `
            <h4>路线 ${index + 1} (${route.steps}步转账)</h4>
            <p><strong>路径:</strong> ${getRoutePathNames(route.path)}</p>
            <p><strong>总费用:</strong> ${(route.totalFees || 0).toFixed(2)} ${document.getElementById('currency').value}</p>
            <p><strong>净到账金额:</strong> ${(route.netAmount || 0).toFixed(2)} ${document.getElementById('currency').value}</p>
            <p><strong>预计总时长:</strong> ${formatDuration(route.totalDuration || 0)}</p>
            <div class="route-details hidden">
                <h5>详细费用:</h5>
                ${route.details.map((step, i) => `
                    <p>第${i + 1}步: ${step.fromBank} → ${step.toBank}<br>
                    转账费: ${(step.transferFee || 0).toFixed(2)} | 到账费: ${(step.arrivalFee || 0).toFixed(2)} | 总费用: ${(step.totalStepFee || 0).toFixed(2)}<br>
                    预计时长: ${step.expectedDuration || '未知'}</p>
                `).join('')}
            </div>
        `;
        
        routesList.appendChild(routeElement);
    });
    
    routesSection.classList.remove('hidden');
    document.getElementById('createTaskBtn').classList.add('hidden');
}

// 获取路线路径名称
function getRoutePathNames(path) {
    return path.map(bankId => {
        const bank = Object.values(banks).find(b => b.id === bankId);
        return bank ? bank.name : bankId;
    }).join(' → ');
}

// 格式化时长
function formatDuration(minutes) {
    if (minutes === 0) return '实时';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}小时${mins > 0 ? `${mins}分钟` : ''}` : `${mins}分钟`;
}

// 选择路线
function selectRoute(route, element) {
    // 移除所有选项的选中状态
    document.querySelectorAll('.route-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('.route-details').classList.add('hidden');
    });
    
    // 选中当前路线
    element.classList.add('selected');
    element.querySelector('.route-details').classList.remove('hidden');
    
    selectedRoute = route;
    document.getElementById('createTaskBtn').classList.remove('hidden');
}

// 创建转账任务
async function createTask() {
    if (!selectedRoute) {
        showAlert('请先选择一条转账路线', 'error');
        return;
    }
    
    const currency = document.getElementById('currency').value;
    const amount = document.getElementById('amount').value;
    const fromBankId = document.getElementById('fromBank').value;
    const toBankId = document.getElementById('toBank').value;
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currency: currency,
                amount: parseFloat(amount),
                fromBankId: fromBankId,
                toBankId: toBankId,
                route: selectedRoute.path
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('转账任务创建成功！', 'success');
            // 重置表单
            document.getElementById('transferForm').reset();
            document.getElementById('routesSection').classList.add('hidden');
            selectedRoute = null;
            
            // 切换到任务列表
            showTab('tasks');
            loadTasks();
        } else {
            showAlert('创建任务失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 加载任务列表
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const result = await response.json();
        
        const tasksList = document.getElementById('tasksList');
        
        if (result.success) {
            if (result.data.length === 0) {
                tasksList.innerHTML = '<div class="alert alert-info">暂无转账任务</div>';
                return;
            }
            
            tasksList.innerHTML = result.data.map(task => `
                <div class="task-card" onclick="viewTask('${task.id}')">
                    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                        <h3>${task.fromBank.name} → ${task.toBank.name}</h3>
                        <span class="task-status status-${task.status}">${getStatusText(task.status)}</span>
                    </div>
                    <p><strong>初始金额:</strong> ${task.amount} ${task.currency}</p>
                    <p><strong>创建时间:</strong> ${new Date(task.createdAt).toLocaleString()}</p>
                    <p><strong>路线:</strong> ${getRoutePathNames(task.route)}</p>
                    <p><strong>当前步骤:</strong> ${task.currentStep + 1}/${task.steps.length}</p>
                    
                    <!-- 显示每一步的金额 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
                        <p><strong>各步骤金额:</strong></p>
                        ${task.steps.map((step, index) => {
                            const bank = Object.values(banks).find(b => b.id === task.route[index + 1]);
                            if (!bank) return '';
                            
                            let amountText = '';
                            if (index === 0) {
                                amountText = `初始金额: ${task.amount} ${task.currency}`;
                            } else if (step && step.arrivalConfirmed) {
                                amountText = `实际到账: ${step.actualAmount} ${task.currency}`;
                            } else if (step && step.status === 'sent' && !step.arrivalConfirmed) {
                                amountText = `预期到账: ${step.expectedAmount} ${task.currency}`;
                            } else if (step) {
                                amountText = `预期到账: ${step.expectedAmount} ${task.currency}`;
                            } else {
                                amountText = `预期到账: ${task.amount - task.steps.slice(0, index).reduce((sum, s) => sum + (s.totalStepFee || 0), 0)} ${task.currency}`;
                            }
                            
                            return `<p style="margin: 0.25rem 0; font-size: 0.9em;">${bank.name}: ${amountText}</p>`;
                        }).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            tasksList.innerHTML = '<div class="alert alert-error">加载任务失败: ' + result.error + '</div>';
        }
    } catch (error) {
        document.getElementById('tasksList').innerHTML = '<div class="alert alert-error">网络错误: ' + error.message + '</div>';
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待开始',
        'processing': '处理中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

// 查看任务详情
function viewTask(taskId) {
    currentTask = taskId;
    showTab('manage');
    loadTaskManagement();
}

// 加载任务管理界面
async function loadTaskManagement() {
    if (!currentTask) {
        document.getElementById('taskDetails').innerHTML = '<div class="loading">请从任务列表选择一个任务</div>';
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${currentTask}`);
        const result = await response.json();
        
        if (result.success) {
            displayTaskDetails(result.data);
        } else {
            document.getElementById('taskDetails').innerHTML = '<div class="alert alert-error">加载任务详情失败: ' + result.error + '</div>';
        }
    } catch (error) {
        document.getElementById('taskDetails').innerHTML = '<div class="alert alert-error">网络错误: ' + error.message + '</div>';
    }
}

// 显示任务详情
function displayTaskDetails(task) {
    const taskDetails = document.getElementById('taskDetails');
    
    taskDetails.innerHTML = `
        <div class="task-card">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                <h2>${task.fromBank.name} → ${task.toBank.name}</h2>
                <span class="task-status status-${task.status}">${getStatusText(task.status)}</span>
            </div>
            
            <div class="form-group">
                <p><strong>转账金额:</strong> ${task.amount} ${task.currency}</p>
                <p><strong>总费用:</strong> ${(task.totalFees || 0).toFixed(2)} ${task.currency}</p>
                <p><strong>净到账金额:</strong> ${(task.netAmount || 0).toFixed(2)} ${task.currency}</p>
                <p><strong>创建时间:</strong> ${new Date(task.createdAt || new Date()).toLocaleString()}</p>
                <p><strong>最后更新:</strong> ${new Date(task.updatedAt || new Date()).toLocaleString()}</p>
            </div>
            
            <!-- 步骤进度 -->
            <div class="step-progress">
                ${task.route.map((bankId, index) => {
                    const bank = Object.values(banks).find(b => b.id === bankId);
                    const step = task.steps[index - 1]; // 步骤索引比银行路由索引小1
                    
                    // 判断步骤状态
                    let stepClass = 'step';
                    
                    if (task.status === 'completed') {
                        // 任务已完成：所有银行都显示为蓝色
                        stepClass += ' current-bank';
                    } else if (index < task.currentStep) {
                        // 已完成步骤 - 蓝色（资金已到达过）
                        stepClass += ' current-bank';
                    } else if (index === task.currentStep) {
                        // 当前步骤
                        if (step && step.status === 'sent' && !step.arrivalConfirmed) {
                            // 资金已发出但未到账 - 红色
                            stepClass += ' sending-bank';
                        } else if (step && step.arrivalConfirmed) {
                            // 资金在当前银行 - 蓝色
                            stepClass += ' current-bank';
                        } else {
                            // 当前步骤但未开始 - 红色（准备发送）
                            stepClass += ' sending-bank';
                        }
                    } else if (index === task.currentStep + 1 && task.steps[task.currentStep - 1] && task.steps[task.currentStep - 1].arrivalConfirmed) {
                        // 下一步骤，但当前步骤已确认到账 - 蓝色（资金已到达）
                        stepClass += ' current-bank';
                    } else {
                        // 后续步骤 - 灰色
                        stepClass += ' pending';
                    }
                    
                    return `
                        <div class="${stepClass}">
                            <div class="step-circle">${index + 1}</div>
                            <div>${bank ? bank.name : bankId}</div>
                            ${index === 0 ? 
                                // 起始银行：显示初始金额
                                `<div>金额: ${task.amount} ${task.currency}</div>` : 
                                // 对于中间银行和终点银行
                                step && step.arrivalConfirmed ? 
                                    // 已确认到账：显示实际到账金额
                                    `<div>到账: ${step.actualAmount} ${task.currency}</div>` : 
                                    step && step.status === 'sent' && !step.arrivalConfirmed ?
                                        // 已发送但未确认：显示预期到账金额
                                        `<div>预期到账: ${step.expectedAmount} ${task.currency}</div>` :
                                        step ?
                                            // 有步骤信息但未发送：显示预期到账金额
                                            `<div>预期到账: ${step.expectedAmount} ${task.currency}</div>` :
                                            // 没有步骤信息：显示当前步骤的预期金额（直接使用步骤的expectedAmount）
                                            `<div>预期到账: ${task.steps[index - 1] ? task.steps[index - 1].expectedAmount : task.amount - task.steps.slice(0, index).reduce((sum, s) => sum + (s.totalStepFee || 0), 0)} ${task.currency}</div>`
                            }
                        </div>
                        ${index < task.route.length - 1 ? '<div class="step-line"></div>' : ''}
                    `;
                }).join('')}
            </div>
            
            <!-- 操作按钮 -->
            <div style="margin-top: 2rem;">
                ${task.status === 'pending' ? `
                    <button class="btn btn-red" onclick="startTransfer()">从${task.fromBank.name}发送</button>
                ` : ''}
                
                ${task.status === 'processing' && task.currentStep < task.steps.length && task.steps[task.currentStep] && task.steps[task.currentStep].status === 'sent' && !task.steps[task.currentStep].arrivalConfirmed ? `
                    <div class="form-group">
                        <label for="actualAmount">实际到账金额</label>
                        <input type="number" id="actualAmount" class="form-control" value="${task.steps[task.currentStep].expectedAmount}" step="0.01">
                        <label for="amountReason">金额不一致原因（可选）</label>
                        <input type="text" id="amountReason" class="form-control" placeholder="如金额不一致，请说明原因">
                        <button class="btn btn-blue" onclick="confirmArrival()" style="margin-top: 1rem;">确认${Object.values(banks).find(b => b.id === task.route[task.currentStep + 1]) ? Object.values(banks).find(b => b.id === task.route[task.currentStep + 1]).name : '目标银行'}到账</button>
                    </div>
                ` : ''}
                
                ${task.status === 'processing' && task.currentStep < task.steps.length - 1 && task.steps[task.currentStep] && task.steps[task.currentStep].arrivalConfirmed ? `
                    <button class="btn btn-red" onclick="sendNextStep()">从${Object.values(banks).find(b => b.id === task.route[task.currentStep + 1]) ? Object.values(banks).find(b => b.id === task.route[task.currentStep + 1]).name : '当前银行'}发送</button>
                ` : ''}
                
                ${task.status === 'processing' || task.status === 'pending' ? `
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="cancelReason">取消原因</label>
                        <input type="text" id="cancelReason" class="form-control" placeholder="请输入取消原因" required>
                        <button class="btn btn-danger" onclick="cancelTask()" style="margin-top: 0.5rem;">取消任务</button>
                    </div>
                ` : ''}
                
                ${task.status === 'completed' ? `
                    <div class="alert alert-success">
                        <h4>任务已完成！</h4>
                        <p>总费用: ${(task.totalFees || 0).toFixed(2)} ${task.currency}</p>
                        <p>净到账金额: ${(task.netAmount || 0).toFixed(2)} ${task.currency}</p>
                    </div>
                ` : ''}
                
                ${task.status === 'cancelled' ? `
                    <div class="alert alert-error">
                        <h4>任务已取消</h4>
                        <p>取消原因: ${task.cancellationReason}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// 开始转账
async function startTransfer() {
    try {
        const response = await fetch(`/api/tasks/${currentTask}/start`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('转账已开始！', 'success');
            loadTaskManagement();
        } else {
            showAlert('开始转账失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 确认资金到账
async function confirmArrival() {
    const actualAmount = document.getElementById('actualAmount').value;
    const reason = document.getElementById('amountReason').value;
    
    if (!actualAmount) {
        showAlert('请输入实际到账金额', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${currentTask}/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                actualAmount: parseFloat(actualAmount),
                reason: reason
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('资金到账已确认！', 'success');
            loadTaskManagement();
        } else {
            showAlert('确认到账失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 发送下一步资金
async function sendNextStep() {
    try {
        const response = await fetch(`/api/tasks/${currentTask}/next`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('下一步资金已发送！', 'success');
            loadTaskManagement();
        } else {
            showAlert('发送下一步失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 取消任务
async function cancelTask() {
    const reason = document.getElementById('cancelReason').value;
    
    if (!reason) {
        showAlert('请输入取消原因', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${currentTask}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('任务已取消！', 'success');
            loadTaskManagement();
        } else {
            showAlert('取消任务失败: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('网络错误: ' + error.message, 'error');
    }
}

// 显示提示信息
function showAlert(message, type) {
    const alertArea = document.getElementById('alertArea');
    const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
    
    alertArea.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    
    // 3秒后自动消失
    setTimeout(() => {
        alertArea.innerHTML = '';
    }, 3000);
}