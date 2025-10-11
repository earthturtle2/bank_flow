const { v4: uuidv4 } = require('uuid');
const TransferTask = require('../models/TransferTask');

class TransferService {
  constructor(persistence, banks) {
    this.persistence = persistence;
    this.banks = banks;
    this.routePlanner = new (require('./RoutePlanner'))(banks);
  }

  // 创建新的转账任务
  async createTransferTask(currency, amount, fromBankId, toBankId, selectedRoute) {
    // 验证银行和币种
    // 注意：前端传递的bankId是字符串，需要转换为数字进行比较
    const fromBank = Object.values(this.banks).find(b => b.id === parseInt(fromBankId));
    const toBank = Object.values(this.banks).find(b => b.id === parseInt(toBankId));
    
    if (!fromBank || !toBank) {
      throw new Error('银行不存在');
    }
    
    if (!fromBank.currencies.includes(currency) || !toBank.currencies.includes(currency)) {
      throw new Error('银行不支持该币种');
    }
    
    // 验证路线
    let route;
    if (selectedRoute) {
      route = selectedRoute;
    } else {
      const routes = this.routePlanner.findAllRoutes(fromBankId, toBankId, 5); // 增加最大步数到5
      if (routes.length === 0) {
        throw new Error('没有可用的转账路线');
      }
      route = routes[0].path; // 使用最优路线
    }
    
    // 计算路线详情
    const routeDetails = this.routePlanner.calculateRouteDetails(route, amount);
    
    // 创建任务步骤
    const steps = routeDetails.steps.map((step, index) => ({
      step: index + 1,
      fromBank: step.fromBank,
      toBank: step.toBank,
      expectedAmount: amount - routeDetails.steps.slice(0, index + 1).reduce((sum, s) => sum + s.totalStepFee, 0), // 每一步的预期金额都基于初始金额扣除到当前步骤的累计手续费
      actualAmount: null,
      transferFee: step.transferFee,
      arrivalFee: step.arrivalFee,
      totalStepFee: step.totalStepFee,
      expectedDuration: step.expectedDuration,
      status: 'pending',
      arrivalConfirmed: false,
      amountMismatchReason: '',
      sentAt: null,
      confirmedAt: null
    }));
    
    const taskData = {
      id: uuidv4(),
      currency: currency,
      amount: amount,
      fromBankId: fromBankId,
      toBankId: toBankId,
      route: route,
      currentStep: 0,
      status: 'pending',
      steps: steps,
      totalFees: routeDetails.totalFees,
      netAmount: routeDetails.netAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const task = new TransferTask(taskData);
    return await this.persistence.saveTask(task);
  }

  // 开始转账（发送资金）
  async startTransfer(taskId) {
    const taskData = await this.persistence.getTaskById(taskId);
    if (!taskData) {
      throw new Error('任务不存在');
    }
    
    // 将普通对象转换为TransferTask实例
    const task = new TransferTask(taskData);
    
    if (task.status !== 'pending') {
      throw new Error('任务状态不允许开始转账');
    }
    
    // 模拟扣除真实银行余额
    console.log(`从银行 ${task.fromBankId} 扣除金额 ${task.amount} ${task.currency}`);
    
    task.status = 'processing';
    task.steps[task.currentStep].sentAt = new Date().toISOString();
    task.steps[task.currentStep].status = 'sent';
    task.updatedAt = new Date().toISOString();
    
    return await this.persistence.saveTask(task);
  }

  // 确认资金到账
  async confirmArrival(taskId, actualAmount, reason = '') {
    const taskData = await this.persistence.getTaskById(taskId);
    if (!taskData) {
      throw new Error('任务不存在');
    }
    
    // 将普通对象转换为TransferTask实例
    const task = new TransferTask(taskData);
    
    if (task.status !== 'processing') {
      throw new Error('任务状态不允许确认到账');
    }
    
    task.confirmArrival(actualAmount, reason);
    
    // 检查当前步骤是否是最后一步
    if (task.currentStep === task.steps.length - 1) {
      // 任务完成
      task.status = 'completed';
    } else {
      // 多步转账中，任务状态保持为processing
      // 不自动跳到下一步，等待用户手动调用sendNextStep
      task.status = 'processing';
    }
    
    task.updatedAt = new Date().toISOString();
    return await this.persistence.saveTask(task);
  }

  // 发送下一步资金
  async sendNextStep(taskId) {
    const taskData = await this.persistence.getTaskById(taskId);
    if (!taskData) {
      throw new Error('任务不存在');
    }
    
    // 将普通对象转换为TransferTask实例
    const task = new TransferTask(taskData);
    
    if (task.status !== 'processing' || task.currentStep >= task.steps.length) {
      throw new Error('无法发送下一步');
    }
    
    // 检查当前步骤是否已经完成（资金已到账）
    const currentStep = task.steps[task.currentStep];
    if (!currentStep.arrivalConfirmed) {
      throw new Error('当前步骤资金尚未到账，无法发送下一步');
    }
    
    // 推进到下一步
    task.currentStep++;
    
    // 重新计算下一步的预期金额，基于上一步的实际到账金额扣除当前步骤的手续费
    const nextStep = task.steps[task.currentStep];
    const previousStep = task.steps[task.currentStep - 1];
    
    // 基于上一步的实际到账金额扣除当前步骤的手续费计算下一步的预期金额
    nextStep.expectedAmount = previousStep.actualAmount - nextStep.totalStepFee;
    
    // 模拟扣除当前步骤的银行余额
    console.log(`从银行 ${task.route[task.currentStep]} 发送资金到 ${task.route[task.currentStep + 1]}`);
    
    nextStep.sentAt = new Date().toISOString();
    nextStep.status = 'sent';
    task.updatedAt = new Date().toISOString();
    
    return await this.persistence.saveTask(task);
  }

  // 取消任务
  async cancelTask(taskId, reason) {
    const taskData = await this.persistence.getTaskById(taskId);
    if (!taskData) {
      throw new Error('任务不存在');
    }
    
    // 将普通对象转换为TransferTask实例
    const task = new TransferTask(taskData);
    
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error('任务状态不允许取消');
    }
    
    task.updateStatus('cancelled', reason);
    
    // 模拟退款操作
    console.log(`向银行 ${task.fromBankId} 退款金额 ${task.amount} ${task.currency}`);
    
    return await this.persistence.saveTask(task);
  }

  // 获取所有可能的路线
  async getAvailableRoutes(currency, amount, fromBankId, toBankId) {
    // 验证银行是否支持指定货币
    // 注意：前端传递的bankId是字符串，需要转换为数字进行比较
    const fromBank = Object.values(this.banks).find(b => b.id === parseInt(fromBankId));
    const toBank = Object.values(this.banks).find(b => b.id === parseInt(toBankId));
    
    if (!fromBank || !toBank) {
      throw new Error('银行不存在');
    }
    
    if (!fromBank.currencies.includes(currency)) {
      throw new Error(`发款银行 ${fromBank.name} 不支持货币 ${currency}`);
    }
    
    if (!toBank.currencies.includes(currency)) {
      throw new Error(`收款银行 ${toBank.name} 不支持货币 ${currency}`);
    }
    
    const routes = this.routePlanner.findAllRoutes(fromBankId, toBankId);
    
    return routes.map(route => {
      const details = this.routePlanner.calculateRouteDetails(route.path, amount);
      return {
        path: route.path,
        steps: route.steps,
        totalFees: details.totalFees,
        totalDuration: details.totalDuration,
        netAmount: details.netAmount,
        details: details.steps
      };
    });
  }

  // 获取任务详情
  async getTaskDetails(taskId) {
    const task = await this.persistence.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }
    
    // 补充银行信息
    const enrichedTask = { ...task };
    // 将bank_001格式的ID转换为数字ID
    const fromBankId = task.fromBankId.startsWith('bank_') ? parseInt(task.fromBankId.replace('bank_', '')) : parseInt(task.fromBankId);
    const toBankId = task.toBankId.startsWith('bank_') ? parseInt(task.toBankId.replace('bank_', '')) : parseInt(task.toBankId);
    enrichedTask.fromBank = Object.values(this.banks).find(b => b.id === fromBankId);
    enrichedTask.toBank = Object.values(this.banks).find(b => b.id === toBankId);
    enrichedTask.routeBanks = task.route.map(bankId => {
      // 处理bankId可能是字符串或数字的情况
      const bankIdStr = String(bankId);
      const bankIdNum = bankIdStr.startsWith('bank_') ? parseInt(bankIdStr.replace('bank_', '')) : parseInt(bankIdStr);
      return Object.values(this.banks).find(b => b.id === bankIdNum);
    });
    
    return enrichedTask;
  }
}

module.exports = TransferService;