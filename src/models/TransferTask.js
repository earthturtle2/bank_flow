class TransferTask {
  constructor(data) {
    this.id = data.id;
    this.currency = data.currency;
    this.amount = data.amount;
    this.fromBankId = data.fromBankId;
    this.toBankId = data.toBankId;
    this.route = data.route || []; // 转账路线
    this.currentStep = data.currentStep || 0; // 当前步骤索引
    this.status = data.status || 'pending'; // pending, processing, completed, cancelled
    this.steps = data.steps || []; // 每一步的详细信息
    this.totalFees = data.totalFees || 0;
    this.netAmount = data.netAmount || 0; // 净到账金额
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.cancellationReason = data.cancellationReason || '';
  }

  // 计算每一步的费用
  calculateStepFees(stepIndex, banks) {
    if (stepIndex >= this.route.length - 1) return 0;
    
    const fromBank = banks.find(b => b.id === this.route[stepIndex]);
    const toBank = banks.find(b => b.id === this.route[stepIndex + 1]);
    
    if (!fromBank || !toBank) return 0;
    
    const connection = fromBank.reachableBanks.find(r => r.bankId === toBank.id);
    if (!connection) return 0;
    
    const transferFee = connection.transferFee.fixed + (this.amount * connection.transferFee.percentage);
    const arrivalFee = connection.arrivalFee.fixed + (this.amount * connection.arrivalFee.percentage);
    
    return transferFee + arrivalFee;
  }

  // 更新任务状态
  updateStatus(newStatus, reason = '') {
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();
    if (newStatus === 'cancelled') {
      this.cancellationReason = reason;
    }
  }

  // 移动到下一步
  moveToNextStep() {
    if (this.currentStep < this.route.length - 1) {
      this.currentStep++;
      this.status = 'processing';
      this.updatedAt = new Date().toISOString();
    } else {
      this.status = 'completed';
      this.updatedAt = new Date().toISOString();
    }
  }

  // 确认资金到账
  confirmArrival(actualAmount, reason = '') {
    if (this.currentStep < this.steps.length) {
      this.steps[this.currentStep].actualAmount = actualAmount;
      this.steps[this.currentStep].arrivalConfirmed = true;
      this.steps[this.currentStep].amountMismatchReason = reason;
      this.steps[this.currentStep].confirmedAt = new Date().toISOString();
      
      this.updatedAt = new Date().toISOString();
    }
  }
}

module.exports = TransferTask;